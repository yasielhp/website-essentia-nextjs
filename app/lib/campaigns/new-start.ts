import type { CampaignChannel, CampaignKind } from "@/types/campaign";
import { kindAllowedForChannel } from "./whatsapp-form";

/**
 * Where "new campaign" can start from a link: `?channel=whatsapp&kind=appointment`
 * opens the form with that channel and kind chosen (the messages page sends people
 * to set up an appointment notice). Both must be there, both must be known, and the
 * kind must be one the channel can be: anything else is ignored whole, so a link can
 * never open the form in a state the form itself would not offer.
 */
const CHANNELS: readonly CampaignChannel[] = ["email", "whatsapp"];
const KINDS: readonly CampaignKind[] = [
  "standard",
  "automated",
  "autoresponder",
  "split",
  "rss",
  "dateBased",
  "appointment",
];

export function startFromParams(
  channel: string | string[] | undefined,
  kind: string | string[] | undefined,
): { channel: CampaignChannel; kind: CampaignKind } | null {
  if (typeof channel !== "string" || typeof kind !== "string") return null;
  // `find`, not a lookup in an object: "constructor" is not a kind.
  const chosenChannel = CHANNELS.find((c) => c === channel);
  const chosenKind = KINDS.find((k) => k === kind);
  if (!chosenChannel || !chosenKind) return null;
  if (!kindAllowedForChannel(chosenKind, chosenChannel)) return null;
  return { channel: chosenChannel, kind: chosenKind };
}

/** The link that opens a new appointment notice, ready to be filled. */
export const NEW_APPOINTMENT_NOTICE_HREF =
  "/dashboard/campaigns/new?channel=whatsapp&kind=appointment";
