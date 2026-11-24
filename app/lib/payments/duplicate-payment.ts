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
 * one (null when it was paid at the desk).
 */
export type PaymentArrival =
  | { kind: "retry" }
  | { kind: "duplicate"; firstOrderId: string | null }
  | { kind: "apply" };

const fromRedsys = (e: PaymentEntry) =>
  e.actor_role === "system" && Boolean(e.provider_id);

export function judgeArrival(
  booking: {
    payment_status: string | null;
    amount_paid_eur: number | string | null;
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
  if (earlier.length > 0 || holdsMoney(booking)) {
    return {
      kind: "duplicate",
      firstOrderId: earlier.at(-1)?.provider_id ?? null,
    };
  }
  return { kind: "apply" };
}
