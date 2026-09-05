import { getAdminClient } from "@/lib/insforge-admin";
import { getAppUrl } from "@/lib/env";
import { sendEmailBatch } from "@/emails/send";
import { campaignEmail } from "@/emails/templates/campaign";
import type {
  CampaignContent,
  CampaignLocale,
  CampaignRow,
} from "@/types/campaign";
import { resolveAudience } from "./audience";

/**
 * Sends one campaign, or finishes sending it.
 *
 * SERVER ONLY. Called by the "send now" action and by the cron that dispatches
 * scheduled campaigns and resumes interrupted ones.
 *
 * Claiming the row is the whole concurrency story. The UPDATE that flips the
 * campaign to `sending` only matches from `draft`/`scheduled`, or from a
 * `sending` that has been quiet long enough to be presumed dead, so two callers
 * — a double click, a cron overlapping a manual send — cannot both get a row
 * back, and the one that does not simply reports `not_claimable`.
 *
 * The audience is frozen on the first send: one `queued` row per recipient.
 * Sending then walks the queue in chunks and stamps each row `sent` with the id
 * Resend returned, which is what its webhook will quote. A resume — after a
 * function timeout, say — touches only the rows still `queued`, so nobody gets
 * the email twice.
 */

const CHUNK = 100;

/** A send that has held the row this long without finishing is presumed stuck. */
export const STUCK_AFTER_MS = 10 * 60_000;
/** And one this old is given up on. */
export const ABANDON_AFTER_MS = 2 * 3_600_000;

export type DispatchResult =
  | { ok: true; sent: number; failed: number }
  | {
      ok: false;
      error: "not_claimable" | "empty_audience" | "no_api_key" | "db";
      detail?: string;
    };

type QueuedRow = {
  id: string;
  contact_id: string | null;
  email: string;
  language: CampaignLocale;
  // The SDK types an embedded relation as an array even when it is one row.
  contacts:
    | { first_name: string | null; unsubscribe_token: string | null }
    | { first_name: string | null; unsubscribe_token: string | null }[]
    | null;
};

const one = <T>(value: T | T[] | null): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : value;

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function markFailed(campaignId: string, error: string): Promise<void> {
  await getAdminClient()
    .database.from("campaigns")
    .update({
      status: "failed",
      last_error: error,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);
}

/**
 * Takes the campaign for this process, or returns null when somebody else has
 * it. `resume` widens the claim to a `sending` row older than the stuck window.
 */
async function claim(
  campaignId: string,
  resume: boolean,
  now: Date,
): Promise<CampaignRow | null> {
  const db = getAdminClient().database;
  let query = db
    .from("campaigns")
    .update({
      status: "sending",
      sending_started_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", campaignId);

  query = resume
    ? query
        .eq("status", "sending")
        .lt(
          "sending_started_at",
          new Date(now.getTime() - STUCK_AFTER_MS).toISOString(),
        )
    : query.in("status", ["draft", "scheduled"]);

  const { data, error } = await query.select("*");
  if (error) throw new Error(error.message);
  return ((data as CampaignRow[] | null) ?? [])[0] ?? null;
}

export async function dispatchCampaign(
  campaignId: string,
  opts: { resume?: boolean } = {},
): Promise<DispatchResult> {
  const db = getAdminClient().database;
  const now = new Date();
  const resume = opts.resume === true;

  let campaign: CampaignRow | null;
  try {
    campaign = await claim(campaignId, resume, now);
  } catch (err) {
    return { ok: false, error: "db", detail: (err as Error).message };
  }
  if (!campaign) return { ok: false, error: "not_claimable" };

  // `sendEmail` shrugs when the key is missing, which is right for a booking
  // confirmation and wrong here: a campaign that silently went nowhere would
  // sit in the list as "sent".
  if (!process.env.RESEND_API_KEY) {
    await markFailed(campaignId, "RESEND_API_KEY is not set");
    return { ok: false, error: "no_api_key" };
  }

  // Fresh sends freeze the audience now; resumes keep the frozen list.
  if (!resume) {
    let recipients;
    try {
      recipients = await resolveAudience(campaign.audience, now);
    } catch (err) {
      const detail = (err as Error).message;
      await markFailed(campaignId, detail);
      return { ok: false, error: "db", detail };
    }
    if (recipients.length === 0) {
      await markFailed(campaignId, "empty_audience");
      return { ok: false, error: "empty_audience" };
    }

    // Emails arrive lowercased and deduped from the resolver, which is what
    // the unique index on (campaign_id, email) relies on.
    const { error: insertError } = await db.from("campaign_recipients").upsert(
      recipients.map((r) => ({
        campaign_id: campaignId,
        contact_id: r.id,
        email: r.email,
        language: r.language,
        status: "queued",
      })),
      { onConflict: "campaign_id,email", ignoreDuplicates: true },
    );
    if (insertError) {
      await markFailed(campaignId, insertError.message);
      return { ok: false, error: "db", detail: insertError.message };
    }
  }

  const { data: queued, error: queuedError } = await db
    .from("campaign_recipients")
    .select(
      "id, contact_id, email, language, contacts(first_name, unsubscribe_token)",
    )
    .eq("campaign_id", campaignId)
    .eq("status", "queued");
  if (queuedError) {
    await markFailed(campaignId, queuedError.message);
    return { ok: false, error: "db", detail: queuedError.message };
  }

  const rows = (queued ?? []) as QueuedRow[];
  const content = campaign.content as CampaignContent;
  const appUrl = getAppUrl();
  let sent = 0;
  let failed = 0;
  let lastError: string | null = null;

  for (let start = 0; start < rows.length; start += CHUNK) {
    const chunk = rows.slice(start, start + CHUNK);
    const emails = chunk.map((row) => {
      const contact = one(row.contacts);
      const token = contact?.unsubscribe_token ?? "";
      const unsubscribeUrl = `${appUrl}${row.language === "es" ? "/es" : ""}/newsletter/unsubscribe?token=${token}`;
      const { subject, html } = campaignEmail({
        content: content[row.language],
        firstName: contact?.first_name ?? "",
        unsubscribeUrl,
        locale: row.language,
      });
      return {
        to: row.email,
        subject,
        html,
        blindCopy: false,
        tags: { campaign_id: campaignId },
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      };
    });

    // `sendEmailBatch` already paces its own chunks; each call here is one
    // chunk, so the pacing between calls is ours to keep.
    if (start > 0) await pause(600);
    let result = await sendEmailBatch(emails);
    if (result.error && result.sent === 0) {
      // One retry for a whole-chunk rejection (a 429, a blip); a second
      // failure is recorded and the run moves on.
      await pause(2000);
      result = await sendEmailBatch(emails);
    }

    const at = new Date().toISOString();
    await Promise.all(
      chunk.map((row, index) => {
        const providerId = result.ids[index] ?? null;
        if (providerId) {
          sent += 1;
          return db
            .from("campaign_recipients")
            .update({ status: "sent", provider_id: providerId, sent_at: at })
            .eq("id", row.id);
        }
        failed += 1;
        lastError = result.error ?? "no id returned";
        return db
          .from("campaign_recipients")
          .update({ status: "failed", error: lastError })
          .eq("id", row.id);
      }),
    );
  }

  const [{ count: total }, { count: failedTotal }] = await Promise.all([
    db
      .from("campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId),
    db
      .from("campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("status", "failed"),
  ]);

  const finishedAt = new Date().toISOString();
  await db
    .from("campaigns")
    .update({
      status: "sent",
      sent_at: finishedAt,
      updated_at: finishedAt,
      recipients_count: total ?? 0,
      failed_count: failedTotal ?? 0,
      last_error: lastError,
    })
    .eq("id", campaignId);

  return { ok: true, sent, failed };
}

/**
 * Puts the failed rows back in the queue and sends them; nothing else moves.
 *
 * The campaign is re-opened as a stale `sending` so the ordinary resume claim
 * picks it up, which keeps one code path for "send whatever is still queued".
 */
export async function retryFailed(campaignId: string): Promise<DispatchResult> {
  const db = getAdminClient().database;

  // Reopen first, requeue second: if the campaign is not a finished send the
  // reopen matches nothing, and requeued rows would otherwise sit in `queued`
  // with nobody coming back for them.
  const { data: reopened, error: reopenError } = await db
    .from("campaigns")
    .update({
      status: "sending",
      sending_started_at: new Date(0).toISOString(),
    })
    .eq("id", campaignId)
    .eq("status", "sent")
    .select("id");
  if (reopenError) {
    return { ok: false, error: "db", detail: reopenError.message };
  }
  if (!reopened || (reopened as unknown[]).length === 0) {
    return { ok: false, error: "not_claimable" };
  }

  const { error: requeueError } = await db
    .from("campaign_recipients")
    .update({ status: "queued", error: null })
    .eq("campaign_id", campaignId)
    .eq("status", "failed");
  if (requeueError) {
    await markFailed(campaignId, requeueError.message);
    return { ok: false, error: "db", detail: requeueError.message };
  }

  return dispatchCampaign(campaignId, { resume: true });
}
