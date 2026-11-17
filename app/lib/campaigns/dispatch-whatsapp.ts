import { getAdminClient } from "@/lib/insforge-admin";
import { sendTemplateMessage, type TemplateSend } from "@/lib/whatsapp/client";
import type {
  WhatsAppParamSource,
  WhatsAppSendResult,
  WhatsAppTemplateRow,
} from "@/lib/whatsapp/types";
import { sendLocaleOf } from "@/lib/schemas";
import type { CampaignLocale, CampaignRow } from "@/types/campaign";
import type { QueuedRow } from "./dispatch";
import { paramsMatchTemplate, resolveParams } from "./whatsapp-params";

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

/** Begins the `error` of a row whose delivery is in doubt; a retry skips it. */
export const UNCONFIRMED_PREFIX = "[unconfirmed] ";

type Db = ReturnType<typeof getAdminClient>["database"];

export type WhatsAppDeps = {
  db?: Db;
  send?: (send: TemplateSend) => Promise<WhatsAppSendResult>;
  /** Milliseconds, like `Date.now`. */
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  budgetMs?: number;
};

export type WhatsAppSendOutcome = {
  sent: number;
  failed: number;
  lastError: string | null;
  /** Rows still `queued` when this returned. The campaign is not done while any remain. */
  remaining: number;
};

export type TemplateIssue =
  | "template_missing"
  | "template_not_approved"
  | "template_unsupported"
  | "template_language"
  | "param_count";

/**
 * Null when the template can go out for this campaign; otherwise why not.
 *
 * Only an approved template that the dashboard can fill is sendable, it must
 * exist in the language the campaign is written in (`es_ES` serves `es`), and
 * the campaign must supply exactly the parameters it declares.
 */
export function whatsappTemplateEligibility(
  template: WhatsAppTemplateRow | null | undefined,
  sendLocale: CampaignLocale,
  sources: WhatsAppParamSource[],
): TemplateIssue | null {
  if (!template) return "template_missing";
  if (template.status !== "APPROVED") return "template_not_approved";
  if (template.unsupported_reason !== null) return "template_unsupported";
  const language = template.language.toLowerCase().replace("-", "_");
  if (language !== sendLocale && !language.startsWith(`${sendLocale}_`)) {
    return "template_language";
  }
  if (paramsMatchTemplate(sources, template.param_count) !== null) {
    return "param_count";
  }
  return null;
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
  campaign: Pick<CampaignRow, "content" | "audience">,
  template: WhatsAppTemplateRow | null,
): TemplateIssue | null {
  return whatsappTemplateEligibility(
    template,
    sendLocaleOf(campaign.audience),
    campaign.content.whatsapp?.params ?? [],
  );
}

const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type RowOutcome =
  | { kind: "sent" }
  | { kind: "failed"; error: string }
  /** Nothing was sent and the row stays queued. */
  | { kind: "deferred"; error: string };

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
      lastError: `template_unavailable: ${issue ?? "template_missing"}`,
      remaining: rows.length,
    };
  }
  const chosen = template;

  /**
   * One update per message, retried once. If the write still fails the
   * message has already left; the row stays `queued` and a resume would send
   * it again, so it is logged where somebody can find it.
   */
  async function record(
    row: QueuedRow,
    patch: Record<string, unknown>,
  ): Promise<void> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let failure: string | null = null;
      try {
        const { error } = await db
          .from("campaign_recipients")
          .update(patch)
          .eq("id", row.id);
        failure = error ? error.message : null;
      } catch (err) {
        // A throw here would escape the batch and abandon the rest of it.
        failure = err instanceof Error ? err.message : "update threw";
      }
      if (failure === null) return;
      if (attempt === 1) {
        console.error(
          `[campaigns] row ${row.id} could not be updated after its WhatsApp answer:`,
          failure,
        );
      }
    }
  }

  async function sendOne(row: QueuedRow): Promise<RowOutcome> {
    if (!row.phone) {
      const error = "no phone";
      await record(row, { status: "failed", error });
      return { kind: "failed", error };
    }

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
      const error = `params: ${(err as Error).message}`;
      await record(row, { status: "failed", error });
      return { kind: "failed", error };
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
      return { kind: "deferred", error: "whatsapp_not_configured" };
    }
    if (result.status === "sent") {
      await record(row, {
        status: "sent",
        provider_id: result.providerId,
        sent_at: new Date(now()).toISOString(),
      });
      return { kind: "sent" };
    }
    const error = result.ambiguous
      ? `${UNCONFIRMED_PREFIX}${result.error}`
      : result.error;
    await record(row, { status: "failed", error });
    return { kind: "failed", error };
  }

  let sent = 0;
  let failed = 0;
  let lastError: string | null = null;
  const overBudget = () => now() - startedAt >= budgetMs;

  for (let start = 0; start < rows.length; start += PER_SECOND) {
    if (overBudget()) break;
    const batchStartedAt = now();
    const batch = rows.slice(start, start + PER_SECOND);
    const outcomes = await Promise.all(batch.map(sendOne));

    let deferred = false;
    for (const outcome of outcomes) {
      if (outcome.kind === "sent") sent += 1;
      else {
        lastError = outcome.error;
        if (outcome.kind === "failed") failed += 1;
        else deferred = true;
      }
    }
    // Without credentials every remaining row would be skipped too.
    if (deferred) break;

    if (start + PER_SECOND < rows.length) {
      const wait = Math.max(0, 1000 - (now() - batchStartedAt));
      // No point sleeping towards a batch the budget will not let begin.
      if (now() - startedAt + wait >= budgetMs) break;
      if (wait > 0) await sleep(wait);
    }
  }

  return { sent, failed, lastError, remaining: rows.length - sent - failed };
}
