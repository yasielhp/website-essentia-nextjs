import { getAdminClient } from "@/lib/insforge-admin";
import { getAppUrl } from "@/lib/env";
import { sendEmailBatch } from "@/emails/send";
import { campaignEmail } from "@/emails/templates/campaign";
import type {
  CampaignChannel,
  CampaignContent,
  CampaignLocale,
  CampaignRow,
} from "@/types/campaign";
import { isWhatsAppConfigured } from "@/lib/whatsapp/client";
import { resolveAudience as defaultResolveAudience } from "./audience";
import {
  SKIPPED_PREFIX,
  UNCONFIRMED_PREFIX,
  campaignTemplateIssue,
  haltMessage,
  loadWhatsAppTemplate,
  reconcileInterrupted,
  sendQueuedWhatsApp,
  type WhatsAppDeps,
} from "./dispatch-whatsapp";
import { pause } from "./pause";
import { conflictTarget, recipientRow } from "./recipient-rows";

/**
 * Sends one campaign, or finishes sending it.
 *
 * SERVER ONLY. Called by the "send now" action and by the cron that dispatches
 * scheduled campaigns and resumes interrupted ones. Automated campaigns share
 * `sendQueued` but not the claim: they stay `active` and are fed by
 * `automations.ts` instead.
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
 *
 * A WhatsApp campaign takes the same road with `sendQueuedWhatsApp` in place of
 * the email batch. It may stop early (a time budget, no credentials) and say
 * how many rows are left; the campaign then stays `sending`, and the cron's
 * resume of stuck sends finishes it.
 */

const CHUNK = 100;

type Db = ReturnType<typeof getAdminClient>["database"];

/**
 * What a dispatch reads and calls out to. Every field defaults to the real
 * thing; a test passes doubles. The email path always uses the real database
 * and Resend.
 */
export type DispatchDeps = {
  db?: Db;
  resolveAudience?: typeof defaultResolveAudience;
  isWhatsAppConfigured?: () => boolean;
  /** Reaches `sendQueuedWhatsApp`: the sender, the clock and the sleeper. */
  whatsapp?: Pick<WhatsAppDeps, "send" | "now" | "sleep" | "budgetMs">;
};

/** A send that has held the row this long without finishing is presumed stuck. */
export const STUCK_AFTER_MS = 10 * 60_000;
/** And one this old is given up on. */
export const ABANDON_AFTER_MS = 2 * 3_600_000;

export type DispatchResult =
  | {
      ok: true;
      sent: number;
      failed: number;
      /** WhatsApp only: rows left `queued` for the next run to finish. */
      remaining?: number;
      /** WhatsApp only: messages sent whose answer could not be written down. */
      unrecorded?: number;
      /** WhatsApp only: why the send stopped early on repeated refusals. */
      halted?: string;
    }
  | {
      ok: false;
      error:
        | "not_claimable"
        | "empty_audience"
        | "no_api_key"
        | "whatsapp_not_configured"
        | "template_unavailable"
        | "db";
      /** `template_unavailable`: why (a code from `whatsappTemplateEligibility`). */
      detail?: string;
    };

type QueuedContact = {
  first_name: string | null;
  last_name: string | null;
  unsubscribe_token: string | null;
};

export type QueuedRow = {
  id: string;
  contact_id: string | null;
  /** Null on a WhatsApp row, whose address is the phone. */
  email: string | null;
  /** E.164; null on an email row. */
  phone: string | null;
  language: CampaignLocale;
  variant: "a" | "b" | null;
  vars: Record<string, string> | null;
  // The SDK types an embedded relation as an array even when it is one row.
  contacts: QueuedContact | QueuedContact[] | null;
};

export const QUEUED_FIELDS =
  "id, contact_id, email, phone, language, variant, vars, contacts(first_name, last_name, unsubscribe_token)";

const one = <T>(value: T | T[] | null): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : value;

async function markFailed(
  campaignId: string,
  error: string,
  db: Db = getAdminClient().database,
): Promise<void> {
  await db
    .from("campaigns")
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
  db: Db = getAdminClient().database,
): Promise<CampaignRow | null> {
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

/**
 * Mails every row still `queued` for a campaign, in chunks, stamping each as
 * `sent` or `failed`. Shared by one-off sends and automations.
 *
 * A row's `variant` picks the A/B subject; its `vars` (a blog post's title
 * and link, say) join the recipient's first name in the template.
 */
export async function sendQueued(
  campaign: CampaignRow,
  queued: QueuedRow[],
  whatsapp: WhatsAppDeps = {},
): Promise<{
  sent: number;
  failed: number;
  lastError: string | null;
  /** Only a WhatsApp send can stop early; an email send always finishes. */
  remaining?: number;
  unrecorded?: number;
  halted?: string | null;
}> {
  if (campaign.channel === "whatsapp") {
    return sendQueuedWhatsApp(campaign, queued, whatsapp);
  }
  const db = whatsapp.db ?? getAdminClient().database;
  const content = campaign.content as CampaignContent;
  const appUrl = getAppUrl();
  let sent = 0;
  let failed = 0;
  let lastError: string | null = null;

  // The table lets a row carry only a phone. On an email campaign it has
  // nowhere to go: it fails as skipped instead of being handed to Resend.
  const rows = queued.filter(
    (row): row is QueuedRow & { email: string } => row.email !== null,
  );
  if (rows.length < queued.length) {
    await Promise.all(
      queued
        .filter((row) => row.email === null)
        .map((row) => {
          failed += 1;
          lastError = `${SKIPPED_PREFIX}no_email`;
          return db
            .from("campaign_recipients")
            .update({ status: "failed", error: lastError })
            .eq("id", row.id);
        }),
    );
  }

  for (let start = 0; start < rows.length; start += CHUNK) {
    const chunk = rows.slice(start, start + CHUNK);
    const emails = await Promise.all(
      chunk.map(async (row) => {
        const contact = one(row.contacts);
        const token = contact?.unsubscribe_token ?? "";
        const unsubscribeUrl = `${appUrl}${row.language === "es" ? "/es" : ""}/newsletter/unsubscribe?token=${token}`;
        const block = content[row.language];
        const { subject, html } = await campaignEmail({
          content:
            row.variant === "b" && block.subjectB
              ? { ...block, subject: block.subjectB }
              : block,
          firstName: contact?.first_name ?? "",
          vars: row.vars ?? undefined,
          unsubscribeUrl,
          locale: row.language,
        });
        return {
          to: row.email,
          subject,
          html,
          blindCopy: false,
          tags: { campaign_id: campaign.id },
          headers: {
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        };
      }),
    );

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

  return { sent, failed, lastError };
}

/** The rows of a campaign still waiting to go out. */
export async function loadQueued(
  campaignId: string,
  db: Db = getAdminClient().database,
): Promise<QueuedRow[]> {
  const { data, error } = await db
    .from("campaign_recipients")
    .select(QUEUED_FIELDS)
    .eq("campaign_id", campaignId)
    .eq("status", "queued")
    .range(0, 9_999);
  if (error) throw new Error(error.message);
  return (data ?? []) as QueuedRow[];
}

/** Recounts the campaign's totals from its rows. */
export async function refreshCounts(
  campaignId: string,
  extra: Record<string, unknown> = {},
  db: Db = getAdminClient().database,
): Promise<void> {
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
  await db
    .from("campaigns")
    .update({
      recipients_count: total ?? 0,
      failed_count: failedTotal ?? 0,
      updated_at: new Date().toISOString(),
      ...extra,
    })
    .eq("id", campaignId);
}

type Preflight =
  | { ok: true; channel: CampaignChannel | null }
  | Extract<DispatchResult, { ok: false }>;

/**
 * What must hold before a WhatsApp campaign is claimed or its audience frozen:
 * Meta is reachable and the chosen template can go out. Both are problems of
 * configuration, not of the campaign, so a failure here changes nothing: the
 * campaign stays as it was and can be sent once the cause is fixed.
 *
 * It reads the campaign to learn its channel; an email campaign passes at once.
 */
async function preflight(
  campaignId: string,
  db: Db,
  configured: () => boolean,
): Promise<Preflight> {
  const { data, error } = await db
    .from("campaigns")
    .select("id, channel, status, audience, content")
    .eq("id", campaignId)
    .maybeSingle();
  if (error) return { ok: false, error: "db", detail: error.message };

  const campaign = data as Pick<
    CampaignRow,
    "channel" | "status" | "audience" | "content"
  > | null;
  // No such row: the claim that follows reports it as not claimable.
  if (!campaign) return { ok: true, channel: null };
  if (campaign.channel !== "whatsapp") {
    return { ok: true, channel: campaign.channel };
  }

  // The state is left alone, but a scheduled or stuck campaign the cron keeps
  // finding blocked would otherwise say nothing; a draft gets its answer from
  // the action that called.
  const blocked = async (
    failure: Extract<Preflight, { ok: false }>,
  ): Promise<Preflight> => {
    if (campaign.status === "scheduled" || campaign.status === "sending") {
      await db
        .from("campaigns")
        .update({
          last_error: failure.detail
            ? `${failure.error}: ${failure.detail}`
            : failure.error,
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaignId);
    }
    return failure;
  };

  if (!configured()) {
    return blocked({ ok: false, error: "whatsapp_not_configured" });
  }
  try {
    const template = await loadWhatsAppTemplate(
      db,
      campaign.content.whatsapp?.templateId,
    );
    const issue = campaignTemplateIssue(campaign, template);
    if (issue) {
      return blocked({
        ok: false,
        error: "template_unavailable",
        detail: issue,
      });
    }
  } catch (err) {
    return { ok: false, error: "db", detail: (err as Error).message };
  }
  return { ok: true, channel: "whatsapp" };
}

/** What the cron records on a campaign it gives up on after two hours. */
export function abandonedMessage(lastError: string | null): string {
  if (lastError?.startsWith("template_unavailable")) {
    return `abandoned after two hours: the WhatsApp template could not be sent (${lastError})`;
  }
  if (lastError === "whatsapp_not_configured") {
    return "abandoned after two hours: WhatsApp is not configured on the server";
  }
  return "abandoned after two hours in sending";
}

export async function dispatchCampaign(
  campaignId: string,
  opts: {
    resume?: boolean;
    preflighted?: boolean;
    /** Epoch ms by which the caller's whole invocation must be over. */
    deadlineAt?: number;
  } = {},
  deps: DispatchDeps = {},
): Promise<DispatchResult> {
  const db = deps.db ?? getAdminClient().database;
  const resolveAudience = deps.resolveAudience ?? defaultResolveAudience;
  const configured = deps.isWhatsAppConfigured ?? isWhatsAppConfigured;
  const now = new Date();
  const resume = opts.resume === true;

  if (!opts.preflighted) {
    const checked = await preflight(campaignId, db, configured);
    if (!checked.ok) return checked;
  }

  let campaign: CampaignRow | null;
  try {
    campaign = await claim(campaignId, resume, now, db);
  } catch (err) {
    return { ok: false, error: "db", detail: (err as Error).message };
  }
  if (!campaign) return { ok: false, error: "not_claimable" };

  // `sendEmail` shrugs when the key is missing, which is right for a booking
  // confirmation and wrong here: a campaign that silently went nowhere would
  // sit in the list as "sent".
  const whatsapp = campaign.channel === "whatsapp";
  if (!whatsapp && !process.env.RESEND_API_KEY) {
    await markFailed(campaignId, "RESEND_API_KEY is not set", db);
    return { ok: false, error: "no_api_key" };
  }

  // A resume first settles what the dead process left `sending`: those rows
  // may have gone out, so they fail as unconfirmed instead of being resent.
  if (whatsapp && resume) {
    await reconcileInterrupted(db, campaignId, now.getTime());
  }

  // Fresh sends freeze the audience now; resumes keep the frozen list.
  if (!resume) {
    let recipients;
    try {
      recipients = await resolveAudience(
        campaign.audience,
        now,
        campaign.channel,
      );
    } catch (err) {
      const detail = (err as Error).message;
      await markFailed(campaignId, detail, db);
      return { ok: false, error: "db", detail };
    }
    if (recipients.length === 0) {
      await markFailed(campaignId, "empty_audience", db);
      return { ok: false, error: "empty_audience" };
    }

    // Emails arrive lowercased and deduped from the resolver, which is what
    // the unique index on (campaign_id, email, cycle) relies on. An A/B test
    // deals its recipients out alternately, so both halves are the same size.
    //
    // See `recipientRow` for what a WhatsApp row holds.
    const split = campaign.kind === "split";
    const { error: insertError } = await db.from("campaign_recipients").upsert(
      recipients.map((r, index) =>
        recipientRow({
          campaignId,
          recipient: r,
          channel: campaign.channel,
          audience: campaign.audience,
          cycle: "",
          extra: { variant: split ? (index % 2 === 0 ? "a" : "b") : null },
        }),
      ),
      { onConflict: conflictTarget(campaign.channel), ignoreDuplicates: true },
    );
    if (insertError) {
      await markFailed(campaignId, insertError.message, db);
      return { ok: false, error: "db", detail: insertError.message };
    }
  }

  let rows: QueuedRow[];
  try {
    rows = await loadQueued(campaignId, db);
  } catch (err) {
    const detail = (err as Error).message;
    await markFailed(campaignId, detail, db);
    return { ok: false, error: "db", detail };
  }

  const { sent, failed, lastError, remaining, unrecorded, halted } =
    await sendQueued(campaign, rows, {
      db,
      deadlineAt: opts.deadlineAt,
      ...deps.whatsapp,
    });

  // Meta refused whole batches for one reason: the campaign is failed with the
  // reason and the rest of its queue is left alone. A retry reopens it.
  if (halted) {
    await refreshCounts(
      campaignId,
      { status: "failed", last_error: haltMessage(halted) },
      db,
    );
    return { ok: true, sent, failed, remaining, unrecorded, halted };
  }

  // A WhatsApp send that ran out of time (or credentials) is not finished.
  // Leaving the campaign `sending` is what lets the cron resume it: it claims
  // a `sending` row once it has been quiet for `STUCK_AFTER_MS`.
  if (remaining) {
    await refreshCounts(campaignId, { last_error: lastError }, db);
    return { ok: true, sent, failed, remaining, unrecorded };
  }

  const finishedAt = new Date().toISOString();
  await refreshCounts(
    campaignId,
    {
      status: "sent",
      sent_at: finishedAt,
      // Rows left `sending` because their answer could not be written are not
      // in any count: say so where the admin looks.
      last_error:
        lastError ??
        (unrecorded ? `${unrecorded} sent without being recorded` : null),
    },
    db,
  );

  return unrecorded
    ? { ok: true, sent, failed, unrecorded }
    : { ok: true, sent, failed };
}

/**
 * Puts the failed rows back in the queue and sends them; nothing else moves.
 *
 * The campaign is re-opened as a stale `sending` so the ordinary resume claim
 * picks it up, which keeps one code path for "send whatever is still queued".
 */
export async function retryFailed(
  campaignId: string,
  opts: { deadlineAt?: number } = {},
  deps: DispatchDeps = {},
): Promise<DispatchResult> {
  const db = deps.db ?? getAdminClient().database;

  // Before anything is reopened: a WhatsApp campaign whose template can no
  // longer go out must not be left `sending` with its rows already requeued.
  const checked = await preflight(
    campaignId,
    db,
    deps.isWhatsAppConfigured ?? isWhatsAppConfigured,
  );
  if (!checked.ok) return checked;

  // Reopen first, requeue second: if the campaign is not a finished send the
  // reopen matches nothing, and requeued rows would otherwise sit in `queued`
  // with nobody coming back for them.
  const reopening = db
    .from("campaigns")
    .update({
      status: "sending",
      sending_started_at: new Date(0).toISOString(),
    })
    .eq("id", campaignId);
  // A WhatsApp send can also stop `failed` with rows still queued (Meta kept
  // refusing it); reopening it sends those as well as the retryable failures.
  const { data: reopened, error: reopenError } = await (
    checked.channel === "whatsapp"
      ? reopening.in("status", ["sent", "failed"])
      : reopening.eq("status", "sent")
  ).select("id");
  if (reopenError) {
    return { ok: false, error: "db", detail: reopenError.message };
  }
  if (!reopened || (reopened as unknown[]).length === 0) {
    return { ok: false, error: "not_claimable" };
  }

  let requeue = db
    .from("campaign_recipients")
    .update({ status: "queued", error: null })
    .eq("campaign_id", campaignId)
    .eq("status", "failed");
  // A WhatsApp failure marked unconfirmed may have been delivered after all:
  // resending it could message the same person twice. One marked skipped was
  // refused for lack of consent, which a retry does not change. Both stay
  // failed.
  if (checked.channel === "whatsapp") {
    requeue = requeue.or(
      `error.is.null,and(error.not.like.${UNCONFIRMED_PREFIX.trim()}*,error.not.like.${SKIPPED_PREFIX.trim()}*)`,
    );
  }
  const { error: requeueError } = await requeue;
  if (requeueError) {
    await markFailed(campaignId, requeueError.message, db);
    return { ok: false, error: "db", detail: requeueError.message };
  }

  return dispatchCampaign(
    campaignId,
    { resume: true, preflighted: true, deadlineAt: opts.deadlineAt },
    deps,
  );
}
