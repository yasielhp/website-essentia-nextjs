"use server";

import {
  confirmPublicBookingCore,
  publicSession,
  savePublicDraftCore,
  setPublicDraftTimeCore,
  type ConfirmPublicResult,
  type SaveDraftResult,
  type SetDraftTimeResult,
} from "@/lib/bookings/public-booking";

/**
 * The three writes of the public booking form, as the browser reaches them.
 *
 * Public on purpose, like the form: a guest has no session. Each takes the
 * form's input as `unknown` and hands it to its core in
 * `app/lib/bookings/public-booking.ts`, which checks it against a strict schema
 * and decides everything the visitor does not choose (status, price, payment,
 * place, account). The account is the one the token PROVES, never an id the
 * browser sends.
 */

/** The details step: starts the draft, or rewrites this visit's own. */
// react-doctor-disable-next-line react-doctor/server-auth-actions
export async function savePublicDraft(
  accessToken: string | null,
  input: unknown,
): Promise<SaveDraftResult> {
  return savePublicDraftCore(await publicSession(accessToken), input);
}

/** The calendar: the day and the hour of a booking that is still a draft. */
// react-doctor-disable-next-line react-doctor/server-auth-actions
export async function setPublicDraftTime(
  input: unknown,
): Promise<SetDraftTimeResult> {
  return setPublicDraftTimeCore(input);
}

/** The last step: the booking, waiting for its payment, or why not. */
// react-doctor-disable-next-line react-doctor/server-auth-actions
export async function confirmPublicBooking(
  accessToken: string | null,
  input: unknown,
): Promise<ConfirmPublicResult> {
  return confirmPublicBookingCore(await publicSession(accessToken), input);
}
