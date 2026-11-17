import type { MessageKey } from "@/lib/messages/catalog";
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

/**
 * The text the editor opens with, and what "reset" restores. Pure.
 *
 * Not what goes out when nothing has been edited: that is still the legacy
 * template, byte for byte.
 */
export function defaultContent(
  key: MessageKey,
  locale: CampaignLocale,
): MessageDefault {
  return DEFAULTS[key][locale];
}
