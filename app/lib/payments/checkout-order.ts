/**
 * Which Redsys order a checkout opens, so a booking is never charged twice.
 *
 * An order number is the last twelve digits of the clock in milliseconds when
 * the checkout started (`RedsysProvider.newOrderId`), and the booking keeps it
 * in `stripe_session_id`. A second checkout of the same unpaid booking (a
 * double click, a second tab, the back button) used to open a NEW order and
 * overwrite the first: a client could pay both, and the webhook would no
 * longer find the booking for the first. Within a few minutes the same order
 * is opened again, so Redsys itself refuses to charge it twice ("pedido
 * repetido"). After that, or once a payment was refused (`failed`), a new one,
 * so a client who gave up at the bank can still pay later.
 */

/** How long a started checkout keeps its order. */
export const REUSE_ORDER_MS = 15 * 60_000;

/** The payment states that hold money: no new checkout for them. */
export const PAID_STATES = ["paid", "deposit_paid", "refunded"];

/** The order to reuse for this booking now, or null for a new one. */
export function orderToReuse(
  booking: { payment_status: string | null; stripe_session_id: string | null },
  now: number,
): string | null {
  if (booking.payment_status !== "pending") return null;
  const order = booking.stripe_session_id;
  if (!order || !/^\d{12}$/.test(order)) return null;
  const age = (now % 1e12) - Number(order);
  return age >= 0 && age <= REUSE_ORDER_MS ? order : null;
}
