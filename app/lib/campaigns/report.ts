import type {
  CampaignChannel,
  CampaignContent,
  CampaignKind,
  CampaignLanguage,
  CampaignRecipientRow,
  CampaignStatus,
  RecipientStatus,
} from "@/types/campaign";
import { audienceLocales } from "./languages";
import {
  SKIPPED_PREFIX,
  UNCONFIRMED_PREFIX,
  INTERRUPTED_ERROR,
  parseHalted,
  parseLocaleHalt,
} from "./error-markers";
import { RUN_FAILED_ERROR } from "./run-markers";

/**
 * What a campaign's report says, over plain values.
 *
 * A note is either a message key (under `dashboard.campaigns.detail.notes`)
 * with its values, or the text exactly as the send wrote it. Anything the
 * send did not mark is shown raw, so Meta's own words and codes reach the
 * admin untouched.
 */
export type ReportNote =
  | { kind: "note"; key: string; values?: Record<string, string> }
  | { kind: "raw"; text: string };

/**
 * What a send writes when messages left and their rows could not be written
 * (`unrecordedMessage` in `dispatch.ts`, the one that makes it), read back by
 * its shape: the count in it is all the screen needs.
 */
const UNRECORDED = /^(\d+) sent without being recorded$/;

/**
 * What an email row whose language had no version to send carries
 * (`missingVersionError` in `dispatch.ts`), and the campaign after it.
 */
const MISSING_VERSION = /^\[skipped\] missing_(es|en)$/;

/**
 * What a WhatsApp send whose template cannot go out writes: the reason (a
 * code of `campaignTemplateEligibility`) and, since a campaign has a template
 * per language, which language's (`templateUnavailable` in
 * `dispatch-whatsapp.ts`, and the preflight of `dispatch.ts`).
 */
const TEMPLATE_UNAVAILABLE =
  /^template_unavailable: ([a-z_]+)(?: \((es|en)\))?$/;

/**
 * The `last_error` of a campaign. A marker the engine writes is said in the
 * admin's words, never as it is stored; only what the engine did not mark
 * (Meta's or Resend's own text) reaches the screen untouched. The channel says
 * whether what went out was an email or a WhatsApp message.
 *
 * One language of two stopped (`[halted] (en) …`) is said with its language;
 * while the campaign is `active` that language is held and the other goes on,
 * and the note says how to send it again.
 */
export function describeLastError(
  lastError: string | null | undefined,
  channel?: CampaignChannel,
  status?: CampaignStatus,
): ReportNote | null {
  if (!lastError) return null;
  if (lastError === RUN_FAILED_ERROR) return { kind: "note", key: "runFailed" };
  const missing = MISSING_VERSION.exec(lastError)?.[1];
  if (missing) {
    return {
      kind: "note",
      key: "missingVersion",
      values: { language: missing },
    };
  }
  const template = TEMPLATE_UNAVAILABLE.exec(lastError);
  if (template) {
    const [, issue = "", language] = template;
    return language
      ? {
          kind: "note",
          key: "templateUnavailableIn",
          values: { issue, language },
        }
      : { kind: "note", key: "templateUnavailable", values: { issue } };
  }
  const inOne = parseLocaleHalt(lastError);
  if (inOne) {
    return {
      kind: "note",
      key: status === "active" ? "heldIn" : "haltedIn",
      values: { language: inOne.locale, reason: inOne.reason },
    };
  }
  const unrecorded = (text: string): ReportNote | null => {
    const count = UNRECORDED.exec(text)?.[1];
    return count
      ? {
          kind: "note",
          key: channel === "whatsapp" ? "unrecordedWhatsApp" : "unrecorded",
          values: { count },
        }
      : null;
  };
  const reason = parseHalted(lastError);
  if (reason === null) {
    return unrecorded(lastError) ?? { kind: "raw", text: lastError };
  }
  return (
    unrecorded(reason) ??
    (reason
      ? { kind: "note", key: "haltedReason", values: { reason } }
      : { kind: "note", key: "haltedNoReason" })
  );
}

/** Every message key a note can carry; the report's messages must have each. */
export const REPORT_NOTE_KEYS = [
  "haltedReason",
  "haltedNoReason",
  "haltedIn",
  "heldIn",
  "runFailed",
  "missingVersion",
  "templateUnavailable",
  "templateUnavailableIn",
  "unrecorded",
  "unrecordedWhatsApp",
  "unconfirmedInterrupted",
  "unconfirmed",
  "skippedOptedOut",
  "skippedUnreachable",
  "skippedNoConsent",
  "skippedNoConsentAppointment",
  "skippedLate",
  "skippedNoContact",
  "skippedNoEmail",
  "skippedSuppressed",
  "skippedMissingVersion",
  "skippedOther",
] as const;

const SKIP_KEYS: Record<string, string> = {
  opted_out: "skippedOptedOut",
  unreachable: "skippedUnreachable",
  no_consent: "skippedNoConsent",
  late: "skippedLate",
  no_contact: "skippedNoContact",
  no_email: "skippedNoEmail",
  suppressed: "skippedSuppressed",
};

/**
 * The `error` of one recipient. `kind` is the campaign's: a recipient of an
 * appointment notice who is left out for consent lacks the consent to
 * appointment notices, not the one to news and offers, and the note says so.
 */
export function describeRecipientError(
  error: string | null | undefined,
  kind?: CampaignKind,
): ReportNote | null {
  if (!error) return null;
  if (error === INTERRUPTED_ERROR) {
    return { kind: "note", key: "unconfirmedInterrupted" };
  }
  if (error.startsWith(UNCONFIRMED_PREFIX)) {
    return {
      kind: "note",
      key: "unconfirmed",
      values: { detail: error.slice(UNCONFIRMED_PREFIX.length) },
    };
  }
  if (error.startsWith(SKIPPED_PREFIX)) {
    const reason = error.slice(SKIPPED_PREFIX.length);
    if (reason === "no_consent" && kind === "appointment") {
      return { kind: "note", key: "skippedNoConsentAppointment" };
    }
    const missing = MISSING_VERSION.exec(error)?.[1];
    if (missing) {
      return {
        kind: "note",
        key: "skippedMissingVersion",
        values: { language: missing },
      };
    }
    return Object.hasOwn(SKIP_KEYS, reason)
      ? { kind: "note", key: SKIP_KEYS[reason] }
      : { kind: "note", key: "skippedOther", values: { reason } };
  }
  return { kind: "raw", text: error };
}

export type ReportTile =
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "failed";

/**
 * The counters a report shows. Meta reports delivery and reads but no clicks,
 * and has no spam-complaint feed, so a WhatsApp report does not pretend to.
 * (`opened` is the read receipt there, and `bounced` a delivery Meta said
 * failed.)
 */
export function reportTiles(channel: CampaignChannel): ReportTile[] {
  return channel === "whatsapp"
    ? ["sent", "delivered", "opened", "bounced", "failed"]
    : [
        "sent",
        "delivered",
        "opened",
        "clicked",
        "bounced",
        "complained",
        "failed",
      ];
}

/** The states a message has left the building in. */
export const SENT_STATUSES: readonly RecipientStatus[] = [
  "sent",
  "delivered",
  "opened",
  "clicked",
  "bounced",
  "complained",
];
const LEFT: ReadonlySet<RecipientStatus> = new Set(SENT_STATUSES);

/**
 * How many messages a campaign sent, for the list. A row of the list carries
 * `sent_count` only when it was worth counting (a WhatsApp campaign that is not
 * finished: its `recipients_count` still includes the rows waiting); every
 * other campaign has its audience minus the refused.
 */
export function campaignSentCount(campaign: {
  recipients_count: number;
  failed_count: number;
  sent_count?: number;
}): number {
  if (campaign.sent_count !== undefined) return campaign.sent_count;
  return Math.max(0, campaign.recipients_count - campaign.failed_count);
}

/**
 * How many messages actually went out. `recipients_count` also counts the rows
 * still waiting in a long WhatsApp send, so a partial send would read as done.
 */
export function sentCountOf(
  rows: Pick<CampaignRecipientRow, "status">[],
): number {
  return rows.filter((row) => LEFT.has(row.status)).length;
}

/** In the order a message goes through them. */
const ORDER: RecipientStatus[] = [
  "queued",
  "sending",
  "sent",
  "delivered",
  "opened",
  "clicked",
  "bounced",
  "complained",
  "failed",
];

/** How many recipients are in each state, skipping the empty ones. */
export function statusBreakdown(
  rows: Pick<CampaignRecipientRow, "status">[],
): { status: RecipientStatus; count: number }[] {
  const counts = new Map<RecipientStatus, number>();
  for (const { status } of rows) {
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  return ORDER.filter((status) => counts.has(status)).map((status) => ({
    status,
    count: counts.get(status) ?? 0,
  }));
}

/**
 * The subject one variant of an A/B test carried, in each language the
 * campaign went out in (Spanish first): an A/B test has its two subjects per
 * language, and each recipient was dealt one of hers. A subject nobody wrote
 * is left out.
 */
export function variantSubjects(
  campaign: {
    audience: { language: CampaignLanguage };
    content: Pick<CampaignContent, "es" | "en">;
  },
  variant: "a" | "b",
): string[] {
  return audienceLocales(campaign.audience).flatMap((locale) => {
    const block = campaign.content[locale];
    const subject = variant === "a" ? block?.subject : block?.subjectB;
    return subject?.trim() ? [subject] : [];
  });
}
