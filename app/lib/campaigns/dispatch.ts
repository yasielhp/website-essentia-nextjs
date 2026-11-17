import { getAdminClient } from "@/lib/insforge-admin";
import { getAppUrl } from "@/lib/env";
import { sendEmailBatch } from "@/emails/send";
import { campaignEmail } from "@/emails/templates/campaign";
import {
  isAutomatedKind,
  type CampaignChannel,
  type CampaignContent,
  type CampaignLocale,
  type CampaignRow,
} from "@/types/campaign";
import { isWhatsAppConfigured } from "@/lib/whatsapp/client";
import { resolveAudience as defaultResolveAudience } from "./audience";
import {
  INTERRUPTED_AFTER_MS,
  INTERRUPTED_ERROR,
  RETRYABLE_FAILURE_FILTER,
  SKIPPED_PREFIX,
  UNCONFIRMED_PREFIX,
  WRITE_RETRY_MS,
  campaignTemplateIssue,
  haltMessage,
  loadWhatsAppTemplate,
  reconcileInterrupted,
  sendQueuedWhatsApp,
  type WhatsAppDeps,
} from "./dispatch-whatsapp";
import { readAllPages } from "./paged-read";
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
        /** An automated kind: it is switched on, never sent in one go. */
        | "locked"
        | "whatsapp_not_configured"
        | "template_unavailable"
        | "nothing_to_retry"
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
  /**
   * The occasion the row is for: "" for a one-off send, the booking's id for
   * an appointment notice (which is how a run tells whose moment has passed).
   */
  cycle?: string;
  // The SDK types an embedded relation as an array even when it is one row.
  contacts: QueuedContact | QueuedContact[] | null;
};

export const QUEUED_FIELDS =
  "id, contact_id, email, phone, language, variant, vars, cycle, contacts(first_name, last_name, unsubscribe_token)";

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

/** What a campaign says when messages left whose rows could not be written. */
export const unrecordedMessage = (count: number): string =>
  `${count} sent without being recorded`;

/**
 * Moves the chunk's rows `queued` -> `sending` in one conditional UPDATE and
 * answers which ones it moved: those, and only those, are this run's to mail.
 * A row somebody else already moved matches nothing.
 */
async function claimRows(
  db: Db,
  chunk: QueuedRow[],
  nowMs: number,
): Promise<{ ids: Set<string>; error: string | null }> {
  try {
    const { data, error } = await db
      .from("campaign_recipients")
      .update({ status: "sending", claimed_at: new Date(nowMs).toISOString() })
      .in(
        "id",
        chunk.map((row) => row.id),
      )
      .eq("status", "queued")
      .select("id");
    if (error) return { ids: new Set(), error: error.message };
    return {
      ids: new Set(((data ?? []) as { id: string }[]).map((row) => row.id)),
      error: null,
    };
  } catch (err) {
    return {
      ids: new Set(),
      error: err instanceof Error ? err.message : "claim threw",
    };
  }
}

/**
 * Writes what became of an email to its row, tried twice with a short pause.
 * False when both tries failed, which is logged here: an error the SDK hands
 * back (it does not throw) used to go unread.
 */
async function stamp(
  db: Db,
  rowId: string,
  patch: Record<string, unknown>,
  sleep: (ms: number) => Promise<void>,
): Promise<boolean> {
  let failure = "";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) await sleep(WRITE_RETRY_MS);
    try {
      const { error } = await db
        .from("campaign_recipients")
        .update(patch)
        .eq("id", rowId);
      if (!error) return true;
      failure = error.message;
    } catch (err) {
      failure = err instanceof Error ? err.message : "update threw";
    }
  }
  console.error(
    `[campaigns] row ${rowId} could not be updated after its email:`,
    failure,
  );
  return false;
}

/**
 * Mails every row still `queued` for a campaign, in chunks, stamping each as
 * `sent` or `failed`. Shared by one-off sends and automations.
 *
 * A row's `variant` picks the A/B subject; its `vars` (a blog post's title
 * and link, say) join the recipient's first name in the template.
 *
 * Like the WhatsApp sender, it CLAIMS its rows before it mails them: one
 * conditional UPDATE per chunk moves them `queued` -> `sending` and stamps
 * `claimed_at`, and only the rows that UPDATE returned are mailed. So two
 * invocations cannot mail the same row, and a row whose email left can never
 * be found `queued` again, whatever happened afterwards:
 *
 * - Its stamp fails twice: it stays `sending` and is counted `unrecorded`,
 *   which the callers say on the campaign.
 * - The process dies between the claim and the stamp: it stays `sending` too.
 *
 * Either way the reconciliation of interrupted rows closes it five minutes
 * later as `[unconfirmed] interrupted`, which no retry requeues. The price is
 * the one WhatsApp already pays: a row claimed by a process that died before
 * Resend was called is not mailed at all.
 *
 * A chunk Resend refused is tried once more; one whose fate nobody knows is
 * not, and its rows fail as `[unconfirmed]` for the same reason.
 *
 * A claim that cannot be made stops the send with the rest still `queued` and
 * says how many are left, so a one-off campaign stays `sending` for the cron
 * to resume instead of closing with a queue nobody comes back for.
 */
export async function sendQueued(
  campaign: CampaignRow,
  queued: QueuedRow[],
  whatsapp: WhatsAppDeps = {},
): Promise<{
  sent: number;
  failed: number;
  lastError: string | null;
  /**
   * Rows left `queued` for a later run. A WhatsApp send stops early on its
   * time budget; an email send only when a chunk could not be claimed.
   */
  remaining?: number;
  unrecorded?: number;
  halted?: string | null;
  /** WhatsApp only: the last reason Meta itself refused a message for. */
  refusal?: string | null;
}> {
  if (campaign.channel === "whatsapp") {
    return sendQueuedWhatsApp(campaign, queued, whatsapp);
  }
  const db = whatsapp.db ?? getAdminClient().database;
  const sleep = whatsapp.sleep ?? pause;
  const now = whatsapp.now ?? Date.now;
  const content = campaign.content as CampaignContent;
  const appUrl = getAppUrl();
  let sent = 0;
  let failed = 0;
  let unrecorded = 0;
  /** Rows this run claimed, or found claimed by another: no longer in the queue. */
  let taken = 0;
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
          return stamp(
            db,
            row.id,
            { status: "failed", error: lastError },
            sleep,
          );
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

    // Claimed after rendering (a template that throws leaves the queue as it
    // was) and before Resend is called. A row another run took in the meantime
    // is not in the answer and is not mailed here.
    const claimed = await claimRows(db, chunk, now());
    if (claimed.error !== null) {
      lastError = `db: ${claimed.error}`;
      break;
    }
    taken += chunk.length;
    const owned = chunk.flatMap((row, index) =>
      claimed.ids.has(row.id) ? [{ row, email: emails[index]! }] : [],
    );
    if (owned.length === 0) continue;
    const outgoing = owned.map((item) => item.email);

    // `sendEmailBatch` already paces its own chunks; each call here is one
    // chunk, so the pacing between calls is ours to keep.
    if (start > 0) await pause(600);
    let result = await sendEmailBatch(outgoing);
    if (result.rejected && result.sent === 0) {
      // One retry for a chunk Resend itself turned down (a 429, say): nothing
      // of it left, so sending it again writes to nobody twice. A second
      // failure is recorded and the run moves on.
      await sleep(2000);
      result = await sendEmailBatch(outgoing);
    }

    // A failure nobody knows the fate of (the socket dropped, a 5xx: Resend
    // may have taken the chunk) is neither tried again nor a plain `failed`,
    // which "retry the failed ones" would mail a second time. Its rows fail
    // as unconfirmed, the marker no retry requeues.
    const at = new Date().toISOString();
    const chunkError =
      result.error === null
        ? "no id returned"
        : result.rejected
          ? result.error
          : `${UNCONFIRMED_PREFIX}${result.error}`;
    await Promise.all(
      owned.map(async ({ row }, index) => {
        const providerId = result.ids[index] ?? null;
        if (providerId) {
          const recorded = await stamp(
            db,
            row.id,
            { status: "sent", provider_id: providerId, sent_at: at },
            sleep,
          );
          if (recorded) sent += 1;
          else unrecorded += 1;
          return;
        }
        failed += 1;
        lastError = chunkError;
        await stamp(db, row.id, { status: "failed", error: chunkError }, sleep);
      }),
    );
  }

  const remaining = rows.length - taken;
  return {
    sent,
    failed,
    lastError,
    ...(unrecorded > 0 ? { unrecorded } : {}),
    ...(remaining > 0 ? { remaining } : {}),
  };
}

/**
 * The rows of a campaign still waiting to go out: all of them, or an error.
 *
 * Read a page at a time (the database answers at most a thousand rows whatever
 * range is asked for, and a queue cut there was sent as if it were whole), in
 * one total order: when the row was queued, then its id. A page that fails
 * fails the read, so nobody mistakes the first thousand for the queue.
 */
export async function loadQueued(
  campaignId: string,
  db: Db = getAdminClient().database,
): Promise<QueuedRow[]> {
  return readAllPages<QueuedRow>("[loadQueued] queue", (from, to) =>
    db
      .from("campaign_recipients")
      .select(QUEUED_FIELDS)
      .eq("campaign_id", campaignId)
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  ) as Promise<QueuedRow[]>;
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
  | {
      ok: true;
      channel: CampaignChannel | null;
      status: CampaignRow["status"] | null;
    }
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
    .select("id, channel, kind, status, audience, content")
    .eq("id", campaignId)
    .maybeSingle();
  if (error) return { ok: false, error: "db", detail: error.message };

  const campaign = data as Pick<
    CampaignRow,
    "channel" | "kind" | "status" | "audience" | "content"
  > | null;
  // No such row: the claim that follows reports it as not claimable.
  if (!campaign) return { ok: true, channel: null, status: null };

  // An automated kind (an appointment notice above all) is switched on and the
  // cron runs it; it is never sent in one go. The actions refuse it before they
  // get here, but the cron calls this too, so the rule is held here as well. A
  // scheduled or stuck one the cron keeps finding says so on its row.
  if (isAutomatedKind(campaign.kind)) {
    if (campaign.status === "scheduled" || campaign.status === "sending") {
      await db
        .from("campaigns")
        .update({ last_error: "locked", updated_at: new Date().toISOString() })
        .eq("id", campaignId);
    }
    return { ok: false, error: "locked" };
  }
  if (campaign.channel !== "whatsapp") {
    return { ok: true, channel: campaign.channel, status: campaign.status };
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
  return { ok: true, channel: "whatsapp", status: campaign.status };
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
  // On both channels: the email sender claims its rows too.
  if (resume) {
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

  // A queue that cannot be read to its end is not sent in part, and the
  // campaign is neither done nor failed: its audience is frozen and whole, so
  // it stays `sending` with the reason and the cron's resume reads it again.
  let rows: QueuedRow[];
  try {
    rows = await loadQueued(campaignId, db);
  } catch (err) {
    const detail = (err as Error).message;
    await refreshCounts(campaignId, { last_error: `db: ${detail}` }, db);
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
        lastError ?? (unrecorded ? unrecordedMessage(unrecorded) : null),
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

  const whatsapp = checked.channel === "whatsapp";

  // Which failures a retry may send again, on both channels: a failure marked
  // unconfirmed may have been delivered after all (an email whose row could not
  // be stamped, a process that died after its claim) and resending it could
  // write to the same person twice; one marked skipped was refused for lack of
  // consent or of an address, which a retry does not change. Both stay failed.
  //
  // A WhatsApp campaign with nothing to send again (it failed on an empty
  // audience, say, or every failure is one a retry must not repeat) is left as
  // it is, instead of being reopened only to close again with nothing done.
  // The state is checked by the reopen below; this only decides "nothing".
  let retryableIds: string[] = [];
  if (checked.status === "sent" || checked.status === "failed") {
    // Read first, update by id: PostgREST rejects an `or` filter on an UPDATE
    // ("column campaign_recipients.error does not exist"), but accepts it on a
    // read.
    //
    // All of them, a page at a time, or none: the database answers at most a
    // thousand rows, and a retry that saw only those would requeue a part and
    // call it the whole. Nothing has been reopened yet, so a read that fails
    // (or a list past the reader's cap) leaves the campaign exactly as it was
    // and says why.
    let retryable: { id: string }[];
    try {
      retryable = await readAllPages<{ id: string }>(
        "[retryFailed] failures",
        (from, to) =>
          db
            .from("campaign_recipients")
            .select("id")
            .eq("campaign_id", campaignId)
            .eq("status", "failed")
            .or(RETRYABLE_FAILURE_FILTER)
            .order("id", { ascending: true })
            .range(from, to),
      );
    } catch (err) {
      return { ok: false, error: "db", detail: (err as Error).message };
    }
    const pending = await db
      .from("campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("status", "queued");
    if (pending.error) {
      return { ok: false, error: "db", detail: pending.error.message };
    }
    retryableIds = retryable.map((row) => row.id);
    if (whatsapp && retryableIds.length === 0 && (pending.count ?? 0) === 0) {
      return { ok: false, error: "nothing_to_retry" };
    }
  }

  // Reopen first, requeue second: if the campaign is not a finished send the
  // reopen matches nothing, and requeued rows would otherwise sit in `queued`
  // with nobody coming back for them.
  //
  // Reopened as a send that went quiet a second past the stuck window: stale
  // enough for the resume claim below, and for the cron's if this process dies
  // before it, but two hours short of the age at which the cron gives up on a
  // send. (The epoch, as it used to be, read as abandoned to a tick that looked
  // in between.)
  const reopening = db
    .from("campaigns")
    .update({
      status: "sending",
      sending_started_at: new Date(
        Date.now() - STUCK_AFTER_MS - 1000,
      ).toISOString(),
    })
    .eq("id", campaignId);
  // A WhatsApp send can also stop `failed` with rows still queued (Meta kept
  // refusing it); reopening it sends those as well as the retryable failures.
  const { data: reopened, error: reopenError } = await (
    whatsapp
      ? reopening.in("status", ["sent", "failed"])
      : reopening.eq("status", "sent")
  ).select("id");
  if (reopenError) {
    return { ok: false, error: "db", detail: reopenError.message };
  }
  if (!reopened || (reopened as unknown[]).length === 0) {
    return { ok: false, error: "not_claimable" };
  }

  let requeueError: { message: string } | null = null;
  // In chunks: the ids travel in the URL.
  for (let i = 0; i < retryableIds.length && !requeueError; i += 100) {
    const { error } = await db
      .from("campaign_recipients")
      .update({ status: "queued", error: null })
      .in("id", retryableIds.slice(i, i + 100))
      .eq("status", "failed");
    requeueError = error;
  }
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

/**
 * Fails every row any campaign left `sending` for over five minutes, in one
 * UPDATE, and recounts only the campaigns that had some. Called at the start of
 * every cron tick: without it a one-off campaign already closed as `sent`
 * would keep such rows forever, because nothing resumes it. The rows may have
 * been sent, so they fail as unconfirmed and a retry never requeues them.
 */
export async function reconcileAllInterrupted(
  nowMs: number,
  db: Db = getAdminClient().database,
): Promise<string[]> {
  const { data, error } = await db
    .from("campaign_recipients")
    .update({ status: "failed", error: INTERRUPTED_ERROR })
    .eq("status", "sending")
    .lt("claimed_at", new Date(nowMs - INTERRUPTED_AFTER_MS).toISOString())
    .select("campaign_id");
  if (error) throw new Error(error.message);
  const campaigns = [
    ...new Set(
      ((data ?? []) as { campaign_id: string }[]).map((r) => r.campaign_id),
    ),
  ];
  for (const id of campaigns) await refreshCounts(id, {}, db);
  return campaigns;
}
