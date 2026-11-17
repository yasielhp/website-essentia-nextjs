import { getAdminClient } from "@/lib/insforge-admin";
import { sendTemplateMessage, type TemplateSend } from "@/lib/whatsapp/client";
import { loadSuppressedPhones } from "@/lib/whatsapp/suppression";
import type {
  WhatsAppSendResult,
  WhatsAppTemplateRow,
} from "@/lib/whatsapp/types";
import { sendLocaleOf } from "@/lib/schemas";
import {
  consentPurposeOf,
  type CampaignRow,
  type ConsentPurpose,
} from "@/types/campaign";
import type { QueuedRow } from "./dispatch";
import {
  HALTED_PREFIX,
  INTERRUPTED_ERROR,
  SKIPPED_PREFIX,
  UNCONFIRMED_PREFIX,
  haltMessage,
  parseHalted,
} from "./error-markers";
import { pause } from "./pause";
import {
  campaignTemplateEligibility,
  whatsappTemplateEligibility,
  type CampaignTemplateIssue,
  type TemplateIssue,
} from "./whatsapp-eligibility";
import { resolveParams } from "./whatsapp-params";

// The rule lives in a module the browser can import; the send path keeps its name.
export {
  whatsappTemplateEligibility,
  type CampaignTemplateIssue,
  type TemplateIssue,
};
export {
  HALTED_PREFIX,
  INTERRUPTED_ERROR,
  SKIPPED_PREFIX,
  UNCONFIRMED_PREFIX,
  haltMessage,
  parseHalted,
};

/**
 * Sends the queued rows of a WhatsApp campaign, one template message each.
 *
 * SERVER ONLY. `sendQueued` hands the whole channel to this file; the claim,
 * the frozen audience and the campaign's closing state stay in `dispatch.ts`.
 *
 * This is the path that spends money and the number's reputation, so it is
 * stricter than the email one in three ways:
 *
 * - Each message is written to its row the moment Meta answers, not once per
 *   batch. A process killed half way leaves the rows it did send as `sent`, and
 *   the resume (which sends only `queued` rows) cannot message anyone twice.
 * - It stops starting batches after a time budget and reports what is left.
 *   The caller keeps the campaign open so the cron comes back for the rest.
 * - A failure that may still have been delivered is not a plain `failed`: the
 *   row is stamped `[unconfirmed]` and a retry leaves it alone.
 */

/** Meta allows 80 messages a second by default; this is well under it. */
export const PER_SECOND = 10;

/**
 * The cron lives 60 seconds (`maxDuration` of its route). No new batch starts
 * after this, which leaves room for the batch in flight and for the caller to
 * close up.
 */
export const BUDGET_MS = 45_000;

/**
 * The PostgREST `or` filter that keeps the failed rows a retry may requeue: no
 * error recorded, or one that is neither unconfirmed nor skipped.
 */
export const RETRYABLE_FAILURE_FILTER = `error.is.null,and(error.not.like.${UNCONFIRMED_PREFIX.trim()}*,error.not.like.${SKIPPED_PREFIX.trim()}*)`;

/** Batches in a row, all refused for one reason, after which a send stops. */
export const HALT_AFTER_BATCHES = 3;

/** Pause before the second try of a row's write. */
export const WRITE_RETRY_MS = 250;

/**
 * A row held in `sending` this long belongs to a process that died: an
 * invocation lives 60 s at most, so five minutes is far past any live one.
 * Deliberately shorter than the campaign's own stuck window.
 */
export const INTERRUPTED_AFTER_MS = 5 * 60_000;

type Db = ReturnType<typeof getAdminClient>["database"];

/**
 * No batch starts with less than this left before the deadline. A batch can
 * wait on Meta for up to its 10 s timeout and then write ten rows (twice, on a
 * retry), and the caller still has to close up: a batch beginning at second 45
 * must still be over before the function's 60.
 */
export const START_MARGIN_MS = 5000;

export type WhatsAppDeps = {
  db?: Db;
  send?: (send: TemplateSend) => Promise<WhatsAppSendResult>;
  /** Milliseconds, like `Date.now`. */
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  budgetMs?: number;
  /**
   * Epoch milliseconds by which the whole invocation must be over, shared with
   * whatever else the caller does. Absent, only the budget limits the send.
   */
  deadlineAt?: number;
};

export type WhatsAppSendOutcome = {
  sent: number;
  failed: number;
  /**
   * Messages whose answer could not be written to their row, twice. The row is
   * left `sending` (never `queued`: the message may have gone out), and it is
   * counted here and nowhere else.
   */
  unrecorded: number;
  lastError: string | null;
  /**
   * Set when Meta refused three batches in a row for the same reason: the
   * cause is the template or the account, not the contacts, and going on only
   * burns the number's quality. The reason, as stored on the rows.
   */
  halted: string | null;
  /** Rows still `queued` when this returned. The campaign is not done while any remain. */
  remaining: number;
};

export type ConsentRow = {
  id: string;
  whatsapp_opted_out_at: string | null;
  whatsapp_unreachable_at: string | null;
  whatsapp_marketing_opted_in_at: string | null;
  /** Notices about her own appointment: what an appointment campaign needs. */
  whatsapp_opted_in_at?: string | null;
};

export type ConsentVerdict =
  "no_contact" | "opted_out" | "unreachable" | "no_consent" | "suppressed";

/**
 * Why a contact must not get a marketing message right now, or null. The same
 * three facts the audience resolver filters on, but read again at send time:
 * a send can resume hours after its audience was frozen, and a STOP in between
 * must be honoured.
 */
export function consentVerdict(
  contact: ConsentRow | null | undefined,
  /**
   * What the campaign is for. Marketing unless it is a notice about her
   * appointment: each needs its own consent and neither stands in for the
   * other.
   */
  purpose: ConsentPurpose = "marketing",
): ConsentVerdict | null {
  if (!contact) return "no_contact";
  if (contact.whatsapp_opted_out_at) return "opted_out";
  if (contact.whatsapp_unreachable_at) return "unreachable";
  const consent =
    purpose === "appointment"
      ? contact.whatsapp_opted_in_at
      : contact.whatsapp_marketing_opted_in_at;
  if (!consent) return "no_consent";
  return null;
}

async function loadConsent(
  db: Db,
  contactIds: string[],
): Promise<Map<string, ConsentRow>> {
  if (contactIds.length === 0) return new Map();
  const { data, error } = await db
    .from("contacts")
    .select(
      "id, whatsapp_opted_out_at, whatsapp_unreachable_at, whatsapp_marketing_opted_in_at, whatsapp_opted_in_at",
    )
    .in("id", contactIds);
  if (error) throw new Error(error.message);
  return new Map(((data ?? []) as ConsentRow[]).map((c) => [c.id, c]));
}

/** The template a campaign points at, or null when the row is gone. Throws on a read error. */
export async function loadWhatsAppTemplate(
  db: Db,
  templateId: string | null | undefined,
): Promise<WhatsAppTemplateRow | null> {
  if (!templateId) return null;
  const { data, error } = await db
    .from("whatsapp_templates")
    .select("*")
    .eq("id", templateId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as WhatsAppTemplateRow | null) ?? null;
}

/** Eligibility of the template a campaign has chosen, for its own content and audience. */
export function campaignTemplateIssue(
  campaign: Pick<CampaignRow, "content" | "audience" | "kind">,
  template: WhatsAppTemplateRow | null,
): CampaignTemplateIssue | null {
  return campaignTemplateEligibility(
    template,
    sendLocaleOf(campaign.audience),
    campaign.content.whatsapp?.params ?? [],
    campaign.kind,
  );
}

/**
 * Fails the rows a dead process left in `sending`. They may have been sent, so
 * they are stamped `[unconfirmed]` (which a retry never requeues) rather than
 * sent again. Returns how many there were; the caller recounts `failed_count`.
 */
export async function reconcileInterrupted(
  db: Db,
  campaignId: string,
  nowMs: number,
): Promise<number> {
  try {
    const { data, error } = await db
      .from("campaign_recipients")
      .update({ status: "failed", error: INTERRUPTED_ERROR })
      .eq("campaign_id", campaignId)
      .eq("status", "sending")
      .lt("claimed_at", new Date(nowMs - INTERRUPTED_AFTER_MS).toISOString())
      .select("id");
    if (error) {
      console.error("[campaigns] reconcile failed:", error.message);
      return 0;
    }
    return ((data ?? []) as unknown[]).length;
  } catch (err) {
    console.error("[campaigns] reconcile threw:", err);
    return 0;
  }
}

type RowOutcome =
  | { kind: "sent" }
  | {
      kind: "failed";
      error: string;
      /** Meta itself said no, definitively: what the halt watches for. */
      refused?: boolean;
    }
  /** The answer could not be written: the row stays `sending`. */
  | { kind: "unrecorded"; error: string | null }
  /** Nothing was sent and the row is back in the queue. */
  | { kind: "deferred"; error: string };

/**
 * The one reason every message of a batch was refused for, or null. Only
 * Meta's definitive refusals count: an ambiguous failure, a skipped contact or
 * a row without a phone says nothing about the template or the account.
 */
function wholeBatchRefusal(outcomes: RowOutcome[]): string | null {
  const [first] = outcomes;
  if (first?.kind !== "failed" || !first.refused) return null;
  const same = outcomes.every(
    (o) => o.kind === "failed" && o.refused === true && o.error === first.error,
  );
  return same ? first.error : null;
}

export async function sendQueuedWhatsApp(
  campaign: CampaignRow,
  rows: QueuedRow[],
  deps: WhatsAppDeps = {},
): Promise<WhatsAppSendOutcome> {
  const db = deps.db ?? getAdminClient().database;
  const send = deps.send ?? sendTemplateMessage;
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? pause;
  const budgetMs = deps.budgetMs ?? BUDGET_MS;
  const startedAt = now();

  const block = campaign.content.whatsapp;
  let template: WhatsAppTemplateRow | null;
  try {
    template = await loadWhatsAppTemplate(db, block?.templateId);
  } catch (err) {
    return {
      sent: 0,
      failed: 0,
      unrecorded: 0,
      halted: null,
      lastError: `db: ${(err as Error).message}`,
      remaining: rows.length,
    };
  }
  // A template that cannot be sent right now leaves the rows queued instead of
  // failing them: it may come back (PAUSED is not DELETED) and an automation's
  // rows are never requeued by anything else.
  const issue = campaignTemplateIssue(campaign, template);
  if (issue !== null || !template || !block) {
    return {
      sent: 0,
      failed: 0,
      unrecorded: 0,
      halted: null,
      lastError: `template_unavailable: ${issue ?? "template_missing"}`,
      remaining: rows.length,
    };
  }
  const chosen = template;
  // The consent the campaign is for, read again with every batch below.
  const purpose = consentPurposeOf(campaign.kind);

  /**
   * One write to a row, tried twice with a short pause. False when both
   * failed: the message may already have left, so the caller must not treat
   * the row as queued again.
   */
  async function write(
    row: QueuedRow,
    patch: Record<string, unknown>,
  ): Promise<boolean> {
    let failure = "";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (attempt > 0) await sleep(WRITE_RETRY_MS);
      try {
        const { error } = await db
          .from("campaign_recipients")
          .update(patch)
          .eq("id", row.id);
        if (!error) return true;
        failure = error.message;
      } catch (err) {
        // A throw here would escape the batch and abandon the rest of it.
        failure = err instanceof Error ? err.message : "update threw";
      }
    }
    console.error(
      `[campaigns] row ${row.id} could not be updated after its WhatsApp answer:`,
      failure,
    );
    return false;
  }

  /**
   * Moves the batch's rows queued -> sending in one conditional UPDATE. A row
   * somebody else already moved matches nothing and is not ours to send.
   */
  async function claim(
    batch: QueuedRow[],
  ): Promise<{ owned: QueuedRow[]; error: string | null }> {
    try {
      const { data, error } = await db
        .from("campaign_recipients")
        .update({
          status: "sending",
          claimed_at: new Date(now()).toISOString(),
        })
        .in(
          "id",
          batch.map((r) => r.id),
        )
        .eq("status", "queued")
        .select("id");
      if (error) return { owned: [], error: error.message };
      const won = new Set(((data ?? []) as { id: string }[]).map((r) => r.id));
      return { owned: batch.filter((r) => won.has(r.id)), error: null };
    } catch (err) {
      return {
        owned: [],
        error: err instanceof Error ? err.message : "claim threw",
      };
    }
  }

  async function failRow(
    row: QueuedRow,
    error: string,
    refused = false,
  ): Promise<RowOutcome> {
    return (await write(row, { status: "failed", error }))
      ? { kind: "failed", error, refused }
      : { kind: "unrecorded", error };
  }

  async function sendOne(row: QueuedRow): Promise<RowOutcome> {
    const fail = (error: string) => failRow(row, error);

    if (!row.phone) return fail("no phone");

    let bodyParams: string[];
    try {
      const contact = Array.isArray(row.contacts)
        ? row.contacts[0]
        : row.contacts;
      bodyParams = resolveParams(
        block?.params ?? [],
        {
          id: row.contact_id ?? "",
          email: row.email,
          firstName: contact?.first_name ?? "",
          lastName: contact?.last_name ?? null,
          language: row.language,
          phone: row.phone,
        },
        row.vars ?? undefined,
      );
    } catch (err) {
      return fail(`params: ${(err as Error).message}`);
    }

    let result: WhatsAppSendResult;
    try {
      result = await send({
        to: row.phone,
        name: chosen.name,
        language: chosen.language,
        bodyParams,
      });
    } catch (err) {
      // `sendTemplateMessage` never throws; a stand-in that does tells us
      // nothing about whether the message left.
      result = {
        status: "failed",
        error: err instanceof Error ? err.message : "Unknown WhatsApp error",
        ambiguous: true,
      };
    }

    if (result.status === "skipped") {
      // Nothing left the process: give the row back.
      const released = await write(row, { status: "queued", claimed_at: null });
      return released
        ? { kind: "deferred", error: "whatsapp_not_configured" }
        : { kind: "unrecorded", error: "whatsapp_not_configured" };
    }
    if (result.status === "sent") {
      const recorded = await write(row, {
        status: "sent",
        provider_id: result.providerId,
        sent_at: new Date(now()).toISOString(),
      });
      return recorded ? { kind: "sent" } : { kind: "unrecorded", error: null };
    }
    // Meta's code first, so a row's error says which of its refusals it was.
    const text =
      result.code !== undefined
        ? `${result.code}: ${result.error}`
        : result.error;
    return failRow(
      row,
      result.ambiguous ? `${UNCONFIRMED_PREFIX}${text}` : text,
      !result.ambiguous,
    );
  }

  let sent = 0;
  let failed = 0;
  let unrecorded = 0;
  /** Rows another process had already claimed: theirs, not left over. */
  let lost = 0;
  let lastError: string | null = null;
  let halted: string | null = null;
  let refusedBatches = 0;
  let refusedError: string | null = null;
  const deadlineAt = deps.deadlineAt;
  /** Whether a batch beginning at `t` is still inside the budget and the deadline. */
  const mayStartAt = (t: number) =>
    t - startedAt < budgetMs &&
    (deadlineAt === undefined || t + START_MARGIN_MS <= deadlineAt);

  for (let start = 0; start < rows.length; start += PER_SECOND) {
    if (!mayStartAt(now())) break;
    const batchStartedAt = now();
    const batch = rows.slice(start, start + PER_SECOND);

    // Consent is read again before every batch, not trusted from the freeze.
    let consent: Map<string, ConsentRow>;
    try {
      consent = await loadConsent(
        db,
        batch.flatMap((r) => (r.contact_id ? [r.contact_id] : [])),
      );
    } catch (err) {
      lastError = `db: ${err instanceof Error ? err.message : "consent read threw"}`;
      break;
    }

    // The numbers that wrote STOP, by number and whatever contact they sit on,
    // read again before every batch for the same reason as the consent. A list
    // that cannot be read stops the send with the rows still queued: nobody is
    // written to on a guess, and the next tick looks again.
    let suppressed: Set<string>;
    try {
      suppressed = await loadSuppressedPhones(
        db,
        batch.map((r) => r.phone),
      );
    } catch (err) {
      lastError = `db: ${err instanceof Error ? err.message : "suppression read threw"}`;
      break;
    }

    // A contact the read did not return is either a failed read or a delete
    // racing it. Neither is a reason to give up on the row: it stays queued
    // and the next tick looks again. (A contact that is really gone has had
    // its contact_id nulled by the foreign key and is skipped below.)
    const eligible = batch.filter(
      (r) => r.contact_id === null || consent.has(r.contact_id),
    );
    const claimed =
      eligible.length > 0
        ? await claim(eligible)
        : { owned: [] as QueuedRow[], error: null };
    if (claimed.error !== null) {
      lastError = `db: ${claimed.error}`;
      break;
    }
    lost += eligible.length - claimed.owned.length;
    const outcomes = await Promise.all(
      claimed.owned.map((row) => {
        const verdict: ConsentVerdict | null =
          consentVerdict(
            row.contact_id ? consent.get(row.contact_id) : null,
            purpose,
          ) ?? (row.phone && suppressed.has(row.phone) ? "suppressed" : null);
        return verdict
          ? failRow(row, `${SKIPPED_PREFIX}${verdict}`)
          : sendOne(row);
      }),
    );

    let deferred = false;
    for (const outcome of outcomes) {
      if (outcome.kind === "sent") sent += 1;
      else {
        // A skipped contact is routine, not something the admin must read in
        // the campaign's last error, and a lost write has no error of its own:
        // the dispatch reports it as "N sent without being recorded".
        if (
          outcome.error !== null &&
          !outcome.error.startsWith(SKIPPED_PREFIX)
        ) {
          lastError = outcome.error;
        }
        if (outcome.kind === "failed") failed += 1;
        else if (outcome.kind === "unrecorded") unrecorded += 1;
        else deferred = true;
        // A row that could not be handed back says the same: no credentials.
        if (outcome.error === "whatsapp_not_configured") deferred = true;
      }
    }
    // Without credentials every remaining row would be skipped too.
    if (deferred) break;

    // Three whole batches Meta refused for the same reason: stop here.
    if (outcomes.length > 0) {
      const reason = wholeBatchRefusal(outcomes);
      if (reason === null) {
        refusedBatches = 0;
        refusedError = null;
      } else {
        refusedBatches = reason === refusedError ? refusedBatches + 1 : 1;
        refusedError = reason;
      }
      if (refusedBatches >= HALT_AFTER_BATCHES) {
        halted = refusedError;
        break;
      }
    }

    if (start + PER_SECOND < rows.length) {
      const wait = Math.max(0, 1000 - (now() - batchStartedAt));
      // No point sleeping towards a batch the budget will not let begin.
      if (!mayStartAt(now() + wait)) break;
      if (wait > 0) await sleep(wait);
    }
  }

  return {
    sent,
    failed,
    unrecorded,
    lastError,
    halted,
    remaining: rows.length - sent - failed - unrecorded - lost,
  };
}
