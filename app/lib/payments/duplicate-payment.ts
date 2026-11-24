import type { PaymentEntry } from "@/lib/bookings/refund-rules";
import { holdsMoney } from "@/lib/payments/checkout-order";

/**
 * What an authorised Redsys payment is to the booking it arrives for.
 *
 * - `retry`: this order was already recorded (Redsys repeats its
 *   notification): nothing to do.
 * - `duplicate`: the booking already holds money (paid under ANOTHER order,
 *   at the desk, or refunded since): the client paid twice, from two tabs or
 *   an old page. The booking stays paid once; the second payment is recorded
 *   and owed back on its own order.
 * - `apply`: the first money for this booking.
 *
 * `firstOrderId` is the Redsys order the booking was paid under, when there is
 * one (null when it was paid at the desk). Two orders authorised at the same
 * moment both read the booking unpaid and both judge `apply`; only one
 * conditional update lands, and the other, judged again on the booking it
 * then reads (`paidUnder`), is a duplicate, never just a line in a log.
 */
export type PaymentArrival =
  | { kind: "retry" }
  | { kind: "duplicate"; firstOrderId: string | null }
  | { kind: "apply" };

const fromRedsys = (e: PaymentEntry) =>
  e.actor_role === "system" && Boolean(e.provider_id);

/**
 * The booking's own word on which order paid it. The webhook's update that
 * takes the first money writes its order to `stripe_session_id` in the same
 * conditional statement, so a booking that holds money under that column,
 * with nothing taken at the desk, was paid by that order, even in the moment
 * before its history entry is written.
 */
function paidUnder(booking: {
  payment_status: string | null;
  stripe_session_id?: string | null;
  balance_settled_method?: string | null;
}): string | null {
  if (!["paid", "deposit_paid"].includes(booking.payment_status ?? "")) {
    return null;
  }
  if (booking.balance_settled_method) return null;
  return booking.stripe_session_id ?? null;
}

export function judgeArrival(
  booking: {
    payment_status: string | null;
    amount_paid_eur: number | string | null;
    stripe_session_id?: string | null;
    balance_settled_method?: string | null;
  },
  entries: PaymentEntry[],
  orderId: string,
): PaymentArrival {
  if (
    entries.some(
      (e) =>
        (e.event === "paid" || e.event === "duplicate") &&
        fromRedsys(e) &&
        e.provider_id === orderId,
    )
  ) {
    return { kind: "retry" };
  }
  const earlier = entries.filter(
    (e) => e.event === "paid" && fromRedsys(e) && e.provider_id !== orderId,
  );
  if (earlier.length > 0) {
    return {
      kind: "duplicate",
      firstOrderId: earlier.at(-1)?.provider_id ?? null,
    };
  }
  if (holdsMoney(booking)) {
    // Paid, and its entry not written yet: the order that paid is the one the
    // update wrote. The same order again is a retry; another is a duplicate.
    const winner = paidUnder(booking);
    if (winner === orderId) return { kind: "retry" };
    return { kind: "duplicate", firstOrderId: winner };
  }
  return { kind: "apply" };
}
