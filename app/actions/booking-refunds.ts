"use server";

import { z } from "zod";
import { ADMIN_ROLES, AuthError, requireRole } from "@/lib/auth-guard";
import { getAdminClient } from "@/lib/insforge-admin";
import { recordBookingEvent } from "@/lib/booking-events/record";
import type { BookingEventActorRole } from "@/lib/booking-events/types";
import { readRefundContext } from "@/lib/bookings/refunds";
import {
  REFUNDED,
  markableEur,
  onlinePayment,
  refundPatch,
  refundView,
  refundedEur,
  suspectedOnline,
  type BookingRefundView,
  type MarkRefundError,
} from "@/lib/bookings/refund-rules";
import { formatPrice } from "@/utils/format";

/**
 * The online payment of a booking and where its refund stands: the Redsys
 * order number, what was paid online, "Reembolso pendiente" or "Reembolsado",
 * and whether this person may mark it as refunded. Administrators and staff
 * only (a partner sees none of it), read with the service key because the
 * history it comes from is closed to the browser.
 */
export async function fetchBookingRefund(
  accessToken: string | null,
  bookingId: string,
): Promise<BookingRefundView | null> {
  let role: string;
  try {
    ({ role } = await requireRole(accessToken, ["admin", "staff"]));
  } catch (err) {
    if (err instanceof AuthError) return null;
    throw err;
  }
  if (!bookingId) return null;

  try {
    const ctx = await readRefundContext(bookingId);
    if (!ctx) return null;
    return refundView(ctx.booking, ctx.entries, role === "admin");
  } catch (err) {
    console.error("[booking-refunds] could not read the payment:", err);
    return null;
  }
}

const markSchema = z
  .object({
    bookingId: z.string().uuid(),
    amountEur: z.number().finite().positive().max(100_000),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

/**
 * Records that money paid online was returned: by hand, in the Redsys portal,
 * BEFORE pressing this. It returns nothing itself. Administrators only.
 *
 * Only on a cancelled booking, and never more than is left to return (what
 * Redsys took, less what was already returned, and at most what the booking
 * still holds). All of it makes the booking `refunded`, which the ledger
 * stops counting as income; part of it lowers `amount_paid_eur`, so the rest
 * stays income. Who and when go into the history with the amount, the order
 * number and the note. The write is conditioned on the state just read, so a
 * double click or two administrators at once record it once.
 */
export async function markBookingRefunded(
  accessToken: string | null,
  input: { bookingId: string; amountEur: number; note?: string },
): Promise<{ error: MarkRefundError | null }> {
  let actor;
  try {
    actor = await requireRole(accessToken, ADMIN_ROLES);
  } catch (err) {
    if (err instanceof AuthError) return { error: "unauthorized" };
    throw err;
  }

  const parsed = markSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid" };
  const { bookingId, amountEur } = parsed.data;
  const note = parsed.data.note || null;

  const ctx = await readRefundContext(bookingId);
  if (!ctx) return { error: "not_found" };
  // Without the history, what was paid and already returned is unknown.
  if (!ctx.historyRead) return { error: "failed" };
  const { booking, entries } = ctx;
  if (booking.status !== "cancelled") return { error: "not_cancelled" };

  const online = onlinePayment(booking, entries);
  // The Redsys payment on record, or, with none, what the booking held under
  // its order: the administrator checked the portal before pressing this.
  const orderId =
    online.orderId ?? suspectedOnline(booking, entries)?.orderId ?? null;
  const max = markableEur(booking, entries);
  if (max <= 0) return { error: "nothing_to_refund" };
  if (Math.round(amountEur * 100) > Math.round(max * 100)) {
    return { error: "exceeds" };
  }

  const patch = refundPatch(booking, amountEur, refundedEur(entries));
  const whole = "payment_status" in patch;
  const { data, error } = await getAdminClient()
    .database.from("bookings")
    .update(patch)
    .eq("id", bookingId)
    .eq("status", "cancelled")
    .eq("payment_status", booking.payment_status ?? "")
    .eq("amount_paid_eur", Number(booking.amount_paid_eur ?? 0))
    .select("id");
  if (error) return { error: "failed" };
  if (((data ?? []) as unknown[]).length === 0) return { error: "conflict" };

  await recordBookingEvent({
    bookingId,
    channel: "payment",
    event: REFUNDED,
    actorId: actor.userId,
    actorRole: actor.role as BookingEventActorRole,
    summary:
      `Reembolso hecho · ${formatPrice(amountEur, "es")}` +
      (orderId ? ` · pedido ${orderId}` : "") +
      (whole ? "" : " · parcial") +
      (note ? ` · ${note}` : ""),
    providerId: orderId,
    payload: { amountEur, orderId, whole, note },
  });

  return { error: null };
}
