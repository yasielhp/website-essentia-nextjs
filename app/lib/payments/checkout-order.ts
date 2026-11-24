/**
 * Whether a booking may open a Redsys checkout.
 *
 * Every checkout opens a NEW order number (`RedsysProvider.newOrderId`):
 * Redsys refuses an order number that already reached it ("SIS0051 Error
 * número de pedido repetido"), which may include an attempt the client gave up
 * at the card page, so reusing one could leave her unable to pay. Each order
 * opened is written to the booking's history (`payment/checkout`), so a
 * payment that arrives on an older one (two tabs) still finds its booking,
 * and the webhook records a second authorisation as a duplicate to refund
 * (`handleBookingPaid`). A booking that already holds money opens none.
 */

/** The payment states that hold money: no new checkout for them. */
export const PAID_STATES = ["paid", "deposit_paid", "refunded"];

/** True when the booking already holds money, or held it and was refunded. */
export function holdsMoney(booking: {
  payment_status: string | null;
  amount_paid_eur: number | string | null;
}): boolean {
  return (
    PAID_STATES.includes(booking.payment_status ?? "") ||
    Number(booking.amount_paid_eur ?? 0) > 0
  );
}

/** The answer's code for a booking that is already paid. */
export const ALREADY_PAID = "already_paid";
