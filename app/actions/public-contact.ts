"use server";

import {
  savePublicContactCore,
  type PublicContactResult,
} from "@/lib/contacts/public-contact";
import { readVisitor } from "@/lib/bookings/visitor";

/**
 * The contact of the public booking form's details step: whether the address
 * is a member's (she is asked to sign in) and, if not, the contact of the
 * person the booking is for.
 *
 * Public on purpose, like the form: a guest has no session. It takes the
 * form's input as `unknown` and hands it to its core in
 * `app/lib/contacts/public-contact.ts`, which checks it against a strict
 * schema, rate limits it, answers only "member" or not about the address, and
 * writes the contact with the service key. The browser's key can no longer
 * call `check_email_role` or `upsert_contact` (migration
 * `20261124_revoke_public_definer_functions`).
 */
// react-doctor-disable-next-line react-doctor/server-auth-actions
export async function savePublicContact(
  input: unknown,
): Promise<PublicContactResult> {
  return savePublicContactCore(input, { visitor: await readVisitor() });
}
