import type { CampaignStatus } from "@/types/campaign";

/**
 * How strictly a save is validated. A draft only needs a name and well-formed
 * fields, because it is not going anywhere; but a campaign that is `active` or
 * `scheduled` IS going out (the cron reads it as it is saved), so saving it
 * "as a draft" must not let it carry an incomplete message or a template that
 * cannot be sent. Pure, so a test can pin the rule.
 */
export type SaveStrictness = "draft" | "full";

/** The states in which what is saved is what goes out next. */
const LIVE: readonly CampaignStatus[] = ["active", "scheduled"];

export function saveStrictness(
  draftRequested: boolean,
  /** The state of the campaign being edited; null for a new one or an unknown one. */
  savedStatus: CampaignStatus | null,
): SaveStrictness {
  if (!draftRequested) return "full";
  if (savedStatus === null) return "draft";
  return LIVE.includes(savedStatus) ? "full" : "draft";
}

/**
 * The refusal to a loose save of a live campaign that is not complete: it asks
 * for a pause, the one way to keep half a message without it going out.
 */
export const PAUSE_TO_SAVE = "pause_to_save";
