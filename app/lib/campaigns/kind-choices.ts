import type { CampaignChannel, CampaignKind } from "@/types/campaign";
import { kindSwitchAllowed } from "./appointment-form";
import { kindsForChannel } from "./whatsapp-form";

export type KindChoice = {
  kind: CampaignKind;
  /** The kind exists. One that does not yet is shown greyed as "coming soon". */
  implemented: boolean;
  /** It can be picked now: it exists, and a saved campaign may become it. */
  available: boolean;
};

/**
 * What the "Campaign type" select offers, in the order given: the kinds this
 * channel can be (the others are not there at all, not greyed), each with
 * whether it exists and whether it can be picked now. A saved campaign cannot
 * become an appointment notice, or stop being one: it counts appointments, not
 * lists. Pure.
 */
export function kindChoices({
  order,
  implemented,
  channel,
  saved,
  savedKind,
}: {
  order: readonly CampaignKind[];
  implemented: readonly CampaignKind[];
  channel: CampaignChannel;
  /** The campaign is already saved (it has an id). */
  saved: boolean;
  savedKind: CampaignKind | null;
}): KindChoice[] {
  return kindsForChannel(order, channel).map((kind) => {
    const exists = implemented.includes(kind);
    return {
      kind,
      implemented: exists,
      available: exists && (!saved || kindSwitchAllowed(savedKind, kind)),
    };
  });
}
