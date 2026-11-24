import type { CampaignChannel } from "@/types/campaign";
import type { Recipient } from "./audience-filter";

/**
 * The `campaign_recipients` row a frozen or automated recipient becomes, and
 * the unique index that makes a repeat of it a no-op. One place, because the
 * one-off send and the automations must agree on both.
 */

export type ConflictTarget =
  "campaign_id,email,cycle" | "campaign_id,phone,cycle";

/** Email rows are unique on the address, WhatsApp rows on the phone. */
export function conflictTarget(channel: CampaignChannel): ConflictTarget {
  return channel === "whatsapp"
    ? "campaign_id,phone,cycle"
    : "campaign_id,email,cycle";
}

/**
 * A WhatsApp row has no email: NULL, never "", which would collide with every
 * other row on the unique email index and silently drop all but one. Its phone
 * is the resolver's (E.164, already de-duplicated). An email row never carries
 * a phone: the contact's raw one would fail the E.164 check.
 *
 * On both channels `language` is the recipient's, as the resolver set it
 * (`recipientLocale`: her own, or the audience's when it fixes one). It is what
 * picks her version when the row is sent: the email block, or the WhatsApp
 * template, of that language.
 *
 * `extra` goes last: `variant` for a split send, `vars` for an automation.
 */
export function recipientRow(input: {
  campaignId: string;
  recipient: Recipient;
  channel: CampaignChannel;
  cycle: string;
  extra?: Record<string, unknown>;
}): Record<string, unknown> {
  const { recipient, channel } = input;
  const whatsapp = channel === "whatsapp";
  return {
    campaign_id: input.campaignId,
    contact_id: recipient.id,
    email: recipient.email || null,
    ...(whatsapp ? { phone: recipient.phone } : {}),
    language: recipient.language,
    status: "queued",
    cycle: input.cycle,
    ...input.extra,
  };
}
