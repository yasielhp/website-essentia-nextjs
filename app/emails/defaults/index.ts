import type { MessageKey } from "@/lib/messages/catalog";
import { buildMessageDoc } from "@/lib/messages/email-doc";
import type { CampaignLocale } from "@/types/campaign";
import type { MessageDefault, MessageDefaults } from "./_content";
import { bonusPurchase } from "./bonus-purchase";
import { bookingCancelled } from "./booking-cancelled";
import { bookingConfirmed } from "./booking-confirmed";
import { bookingPaid } from "./booking-paid";
import { bookingReceived } from "./booking-received";
import { bookingReminder } from "./booking-reminder";
import { bookingRescheduled } from "./booking-rescheduled";
import { consentRequest } from "./consent-request";

const DEFAULTS: Record<MessageKey, MessageDefaults> = {
  booking_received: bookingReceived,
  booking_confirmed: bookingConfirmed,
  booking_paid: bookingPaid,
  booking_rescheduled: bookingRescheduled,
  booking_cancelled: bookingCancelled,
  booking_reminder: bookingReminder,
  consent_request: consentRequest,
  bonus_purchase: bonusPurchase,
};

const BUILT = new Map<string, MessageDefault>();

/**
 * The text the editor opens with, and what "reset" restores. Pure.
 *
 * `doc` is the WHOLE email as a document: the title, the text and every block
 * the message has, each placed where the legacy email prints it (the closing
 * sentence between the blocks that come before it and the one that follows).
 * `intro` and `outro` stay as the two halves of the text, which the guardian
 * test compares with the legacy templates.
 *
 * Not what goes out when nothing has been edited: that is still the legacy
 * template, byte for byte.
 */
export function defaultContent(
  key: MessageKey,
  locale: CampaignLocale,
): MessageDefault {
  const id = `${key}/${locale}`;
  const known = BUILT.get(id);
  if (known) return known;
  const base = DEFAULTS[key][locale];
  const built: MessageDefault = {
    ...base,
    doc: buildMessageDoc({
      key,
      title: base.title,
      intro: base.intro,
      outro: base.outro,
    }),
  };
  BUILT.set(id, built);
  return built;
}
