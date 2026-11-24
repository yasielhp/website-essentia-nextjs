"use server";

import { AuthError, requireRole } from "@/lib/auth-guard";
import { readRefundContext } from "@/lib/bookings/refunds";
import {
  refundView,
  type BookingRefundView,
} from "@/lib/bookings/refund-rules";

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
