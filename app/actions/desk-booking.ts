"use server";

import { AuthError, requireRole } from "@/lib/auth-guard";
import {
  createDeskBookingCore,
  type DeskCreateResult,
} from "@/lib/bookings/desk-create";
import {
  linkDeskContactCore,
  type DeskContactResult,
} from "@/lib/bookings/desk-contact";

/**
 * Takes a booking at the desk (the dashboard's "New booking").
 *
 * The team only: admin, staff and partner, the roles that enter the
 * dashboard, from the caller's token. What is written, and what the server
 * decides instead of the screen, is in `app/lib/bookings/desk-create.ts`.
 * `session` is the answer to a token that is missing, expired or not the
 * team's: nothing is written.
 */
export async function createDeskBooking(
  accessToken: string | null,
  input: unknown,
): Promise<DeskCreateResult | { ok: false; error: "session" }> {
  let actor;
  try {
    actor = await requireRole(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: "session" };
    throw err;
  }
  return createDeskBookingCore(actor, input);
}

/**
 * The client's contact for a booking taken at the desk: written, or found by
 * its address, before the booking itself. The team only, as above; a partner
 * links or creates, and never changes an existing contact. What is written,
 * and why it is the server's, is in `app/lib/bookings/desk-contact.ts`.
 */
export async function linkDeskContact(
  accessToken: string | null,
  input: unknown,
): Promise<DeskContactResult | { ok: false; error: "session" }> {
  let actor;
  try {
    actor = await requireRole(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: "session" };
    throw err;
  }
  return linkDeskContactCore(actor, input);
}
