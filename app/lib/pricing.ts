/**
 * Paying online is cheaper than paying at the centre.
 *
 * The discount is the incentive that keeps the booking prepaid: a slot held
 * without payment is a slot that can go unused, so the difference has to be
 * worth something to the visitor.
 *
 * The authority on the amount charged is the server — `/api/checkout/booking-session`
 * resolves the price from `service_tiers` and applies this rate there. The
 * booking flow imports the same constant only to show the visitor what they
 * will pay; a mismatch would be a display bug, never an incorrect charge.
 */
export const ONLINE_PAYMENT_DISCOUNT = 0.2;

/** Percentage as shown in copy: "20%". */
export const ONLINE_PAYMENT_DISCOUNT_PERCENT = Math.round(
  ONLINE_PAYMENT_DISCOUNT * 100,
);

/** Amount saved by paying online, rounded to whole euros. */
export function onlineDiscountAmount(priceEur: number): number {
  return Math.round(priceEur * ONLINE_PAYMENT_DISCOUNT);
}

/** What an online payment actually costs. */
export function onlinePrice(priceEur: number): number {
  return priceEur - onlineDiscountAmount(priceEur);
}
