"use server";

import { AuthError, authenticate } from "@/lib/auth-guard";
import { readVisitor } from "@/lib/bookings/visitor";
import {
  registerAccountCore,
  registerGuestCore,
  type RegistrationResult,
} from "@/lib/contacts/event-registration";

/**
 * The registrations of the Running Club and the education programmes, as
 * the pages reach them. What each checks, and why, is in
 * `app/lib/contacts/event-registration.ts`.
 */

/** A guest, from the page's form. Public on purpose: a guest has no session. */
// react-doctor-disable-next-line react-doctor/server-auth-actions
export async function registerGuestForEvent(
  input: unknown,
): Promise<RegistrationResult> {
  return registerGuestCore(input, { visitor: await readVisitor() });
}

/**
 * A signed-in person registers herself, the account her token proves; the
 * team (admin and staff) may name another account. `session` is the answer
 * to a token that is missing, expired or has no profile: nothing is written.
 */
export async function registerAccountForEvent(
  accessToken: string | null,
  input: unknown,
): Promise<RegistrationResult> {
  let actor;
  try {
    actor = await authenticate(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: "session" };
    throw err;
  }
  return registerAccountCore(actor, input);
}
