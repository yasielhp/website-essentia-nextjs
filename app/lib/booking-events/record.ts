import { getAdminClient } from "@/lib/insforge-admin";
import { authenticate } from "@/lib/auth-guard";
import type {
  BookingEventActorRole,
  BookingEventInput,
} from "@/lib/booking-events/types";

/**
 * Writes to the booking history.
 *
 * SERVER ONLY, and deliberately **not** a Server Action: every export of a
 * `"use server"` module is a public HTTP endpoint, and these carry no role
 * check. Exposed that way, anyone could write invented entries into the record
 * the centre trusts to settle "nobody told me".
 *
 * Never throws. The history exists to explain what happened to a booking, and
 * a booking that fails to save because its own log could not be written would
 * be a worse outcome than a gap in the log. Every caller can therefore await
 * this without a `try`.
 */
export async function recordBookingEvent(
  input: BookingEventInput,
): Promise<void> {
  await recordBookingEvents([input]);
}

/**
 * The same, for entries that belong together.
 *
 * One insert rather than one per row: the WhatsApp notifications go to the
 * professional and to every admin at once, and a failure partway through used
 * to leave the first recipient recorded and the rest missing — a history that
 * showed a notification reaching one person when it had reached three.
 */
export async function recordBookingEvents(
  inputs: BookingEventInput[],
): Promise<void> {
  if (inputs.length === 0) return;

  try {
    const { error } = await getAdminClient()
      .database.from("booking_events")
      .insert(
        inputs.map((input) => ({
          booking_id: input.bookingId,
          channel: input.channel,
          event: input.event,
          actor_id: input.actorId ?? null,
          actor_role: input.actorRole ?? null,
          recipient_id: input.recipientId ?? null,
          recipient: input.recipient ?? null,
          // Anything that is not a message has already finished happening by
          // the time it is recorded.
          status: input.status ?? "done",
          error: input.error ?? null,
          provider_id: input.providerId ?? null,
          summary: input.summary,
          payload: input.payload ?? null,
        })),
      );

    // The SDK reports a refused write as a value, not as an exception, so the
    // `catch` below never sees one. Without this line a foreign key or a typo
    // in a column name would drop every entry on the floor in perfect silence
    // — and a history that quietly records nothing is worse than none at all,
    // because the screen still looks like it is working.
    if (error) console.error("[booking-events] insert refused:", error);
  } catch (err) {
    // Fail open, as promised above, but never invisibly.
    console.error("[booking-events] could not record:", err);
  }
}

/**
 * Who is doing this, from the token a dashboard action already receives.
 *
 * Returns the `system` actor rather than throwing when there is no valid
 * token: the public booking form and the cancellation link are anonymous by
 * design, and their entries are worth recording under a name that says so.
 * Callers that know better — the client following their own cancellation link
 * — pass their own role instead.
 */
export async function actorFromToken(
  token: string | null | undefined,
): Promise<{ actorId: string | null; actorRole: BookingEventActorRole }> {
  try {
    const context = await authenticate(token);
    return {
      actorId: context.userId,
      actorRole: context.role as BookingEventActorRole,
    };
  } catch {
    return { actorId: null, actorRole: "system" };
  }
}
