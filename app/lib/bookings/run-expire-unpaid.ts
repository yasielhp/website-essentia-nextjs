import { getAdminClient } from "@/lib/insforge-admin";
import { removeBookingFromCalendars } from "@/lib/calendar-propagate";
import { recordBookingEvent } from "@/lib/booking-events/record";
import {
  UNPAID_EXPIRY_MS,
  isExpiredUnpaid,
  type ExpirableBooking,
} from "./expire-unpaid";

/**
 * Cancels the web bookings whose payment was never completed, freeing the slot.
 *
 * The query only narrows; `isExpiredUnpaid` decides. The update repeats the
 * `pending` + unpaid guard so a payment that lands between the read and the
 * write is not cancelled underneath the client.
 */
export async function expireUnpaidBookings(
  now: Date = new Date(),
): Promise<{ expired: string[] }> {
  const db = getAdminClient().database;
  const cutoff = new Date(now.getTime() - UNPAID_EXPIRY_MS).toISOString();

  const { data } = await db
    .from("bookings")
    .select(
      "id, status, payment_status, payment_mode, created_by_role, created_at",
    )
    .eq("status", "pending")
    .in("payment_status", ["pending", "failed"])
    .in("payment_mode", ["deposit", "full"])
    .lt("created_at", cutoff);

  const rows = (data ?? []) as (ExpirableBooking & { id: string })[];
  if (rows.length === 0) return { expired: [] };

  // When each one's payment was last opened: the window runs from there.
  // Unreadable, nothing is released this time (a client may be at the bank);
  // the next run decides.
  const { data: opened, error: openedError } = await db
    .from("booking_events")
    .select("booking_id, created_at")
    .in(
      "booking_id",
      rows.map((r) => r.id),
    )
    .eq("channel", "payment")
    .eq("event", "checkout");
  if (openedError) {
    console.error("[expire-unpaid] checkout history unreadable:", openedError);
    return { expired: [] };
  }
  const lastCheckout = new Map<string, string>();
  for (const e of (opened ?? []) as {
    booking_id: string;
    created_at: string;
  }[]) {
    const seen = lastCheckout.get(e.booking_id);
    if (!seen || e.created_at > seen)
      lastCheckout.set(e.booking_id, e.created_at);
  }

  const candidates = rows.filter((row) =>
    isExpiredUnpaid(row, now, lastCheckout.get(row.id) ?? null),
  );

  const expired: string[] = [];
  for (const { id } of candidates) {
    const { data: updated } = await db
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("status", "pending")
      .in("payment_status", ["pending", "failed"])
      .select("id");
    if (((updated ?? []) as unknown[]).length === 0) continue;

    expired.push(id);
    await recordBookingEvent({
      bookingId: id,
      channel: "system",
      event: "cancelled",
      actorRole: "system",
      summary: "Caducada: no se completó el pago",
    });
    // Unpaid bookings are not meant to reach a calendar, but the hourly sync
    // may have copied one before it was cancelled.
    try {
      await removeBookingFromCalendars(id);
    } catch {
      // fail-open: the slot is already free in the database
    }
  }
  return { expired };
}
