"use server";

import { AuthError, requireRole } from "@/lib/auth-guard";
import { bookingAccess } from "@/lib/bookings/booking-access";
import { actorFromToken } from "@/lib/booking-events/record";
import type { BookingEventActorRole } from "@/lib/booking-events/types";
import {
  notifyBookingCore,
  readBookingNotification,
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
 * The payload is read before anything else (`readBookingNotification`): its
 * types are only TypeScript's word, and this is a public endpoint. What can be
 * repaired is (a stranger's text is cleaned and cut, and the email still
 * goes); what cannot is answered `invalidInput`, with nothing read, nothing
 * sent and nothing thrown.
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
  const payload = readBookingNotification(input);
  if (!payload) return { ok: false, error: "invalidInput" };

  if (payload.event !== "received") {
    try {
      const actor = await requireRole(accessToken);
      // The team's events go out only for a booking this member may act on:
      // admin and staff any, a partner only her own.
      if (!(await bookingAccess(actor, payload.bookingId)).ok) {
        return { ok: false, error: "unauthorized" };
      }
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
