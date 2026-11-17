import type {
  CampaignChannel,
  CampaignRecipientRow,
  RecipientStatus,
} from "@/types/campaign";
import {
  SKIPPED_PREFIX,
  UNCONFIRMED_PREFIX,
  INTERRUPTED_ERROR,
  parseHalted,
} from "./error-markers";

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

/** The `last_error` of a campaign. */
export function describeLastError(
  lastError: string | null | undefined,
): ReportNote | null {
  if (!lastError) return null;
  const reason = parseHalted(lastError);
  if (reason === null) return { kind: "raw", text: lastError };
  return reason
    ? { kind: "note", key: "haltedReason", values: { reason } }
    : { kind: "note", key: "haltedNoReason" };
}

/** Every message key a note can carry; the report's messages must have each. */
export const REPORT_NOTE_KEYS = [
  "haltedReason",
  "haltedNoReason",
  "unconfirmedInterrupted",
  "unconfirmed",
  "skippedOptedOut",
  "skippedUnreachable",
  "skippedNoConsent",
  "skippedNoContact",
  "skippedNoEmail",
  "skippedOther",
] as const;

const SKIP_KEYS: Record<string, string> = {
  opted_out: "skippedOptedOut",
  unreachable: "skippedUnreachable",
  no_consent: "skippedNoConsent",
  no_contact: "skippedNoContact",
  no_email: "skippedNoEmail",
};

/** The `error` of one recipient. */
export function describeRecipientError(
  error: string | null | undefined,
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
