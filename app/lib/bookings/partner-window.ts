import { hoursUntilSession } from "./cancellation-window";

/**
 * Until when a partner may edit one of her bookings. Pure, and safe in the
 * browser: her screens and the server ask the same function, so the button
 * and the refusal agree, on the Canary clock either way.
 */

/**
 * How long before the session a partner may still edit it: more than 23 hours
 * and 59 minutes, the rule her screen has always applied (`canPartnerEdit` on
 * the booking's page and on its edit screen).
 */
export const PARTNER_EDIT_MIN_MINUTES = 23 * 60 + 59;

/**
 * Whether a partner may still edit a booking that starts at `date` + `time`,
 * counted on the Canary wall clock (`hoursUntilSession`), never the server's.
 * A booking with no day or no hour is editable, as on her screen.
 */
export function partnerMayEdit(
  date: string | null | undefined,
  time: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!date || !time) return true;
  return hoursUntilSession(date, time, now) * 60 > PARTNER_EDIT_MIN_MINUTES;
}
