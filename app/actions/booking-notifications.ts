"use server";

import { AuthError, requireRole } from "@/lib/auth-guard";
import { actorFromToken } from "@/lib/booking-events/record";
import type { BookingEventActorRole } from "@/lib/booking-events/types";
import {
  bookingNotificationSchema,
  notifyBookingCore,
  type BookingNotificationPayload,
} from "@/lib/bookings/notify";

/**
 * Sends the client (and optionally staff) email for a booking event.
 *
 * `received` is reachable from the public booking flow, so it is allowed
 * anonymously, but the recipient is read from the booking row. Every other
 * event is a staff operation and requires a dashboard role. The work itself is
 * `notifyBookingCore`, which the MCP tools call too.
 *
 * The payload is checked before anything else (`bookingNotificationSchema`):
 * its types are only TypeScript's word, and this is a public endpoint. One
 * that does not pass is answered `invalidInput`; nothing is read, nothing is
 * sent and nothing is thrown.
 */
// Only `received` is anonymous — it is the one the public booking flow
// sends — and even then the recipient is read from the booking row rather
// than the payload. Every other event calls `requireRole` a few lines down.
// react-doctor-disable-next-line react-doctor/server-auth-actions
export async function notifyBooking(
  accessToken: string | null,
  input: BookingNotificationPayload,
): Promise<
  { ok: true } | { ok: false; error: "invalidInput" | "unauthorized" }
> {
  const parsed = bookingNotificationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalidInput" };
  const payload: BookingNotificationPayload = parsed.data;

  if (payload.event !== "received") {
    try {
      await requireRole(accessToken);
    } catch (err) {
      if (err instanceof AuthError) return { ok: false, error: "unauthorized" };
      throw err;
    }
  }

  // `received` is the public booking form, where there is no session to read a
  // name from: the history says so rather than inventing a `system` actor.
  const actor: { actorId: string | null; actorRole: BookingEventActorRole } =
    payload.event === "received"
      ? { actorId: null, actorRole: "anonymous" }
      : await actorFromToken(accessToken);

  await notifyBookingCore(payload, actor);
  return { ok: true };
}
