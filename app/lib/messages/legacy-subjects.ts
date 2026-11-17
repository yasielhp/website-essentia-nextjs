import type { CampaignLocale } from "@/types/campaign";
import type { MessageKey } from "./catalog";

/**
 * The subjects the four booking notifications have always gone out with, in
 * ONE place: `notifyBookingCore` sends them when nobody has edited the message,
 * and the guardian test (`app/emails/defaults/defaults.test.ts`) compares the
 * default subjects with these very functions. Change one here and the default
 * of that message must follow, or the test fails.
 *
 * Pure, and no imports but types: the sender must be able to load this
 * whatever else is broken.
 *
 * The other legacy subjects still live in their senders, with a copy in that
 * test: the paid confirmation, the client's own cancellation, the reminder
 * cron, the consent request and the voucher purchase.
 */

/** The messages `notifyBookingCore` sends. */
export type BookingNoticeKey = Extract<
  MessageKey,
  | "booking_received"
  | "booking_confirmed"
  | "booking_cancelled"
  | "booking_rescheduled"
>;

export const LEGACY_BOOKING_SUBJECTS: Record<
  CampaignLocale,
  Record<BookingNoticeKey, (service: string) => string>
> = {
  es: {
    booking_received: (service) => `Solicitud de reserva recibida — ${service}`,
    booking_confirmed: (service) =>
      `Tu reserva ha sido confirmada — ${service}`,
    booking_cancelled: (service) => `Reserva cancelada — ${service}`,
    booking_rescheduled: (service) => `Sesión reprogramada — ${service}`,
  },
  en: {
    booking_received: (service) => `Booking request received — ${service}`,
    booking_confirmed: (service) => `Booking confirmed — ${service}`,
    booking_cancelled: (service) => `Booking cancelled — ${service}`,
    booking_rescheduled: (service) => `Booking rescheduled — ${service}`,
  },
};
