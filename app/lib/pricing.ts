/**
 * Discount for paying online rather than at the centre.
 *
 * Currently zero: the choice between paying now and paying on the day is live,
 * but without an incentive attached while the effect on no-shows is measured.
 * Raise this to bring it back — every surface reads from here, so nothing else
 * needs touching, and the confirm step hides the discount row while it is 0.
 *
 * The authority on the amount charged is the server —
 * `/api/checkout/booking-session` resolves the price from `service_tiers` and
 * applies this rate there. The booking flow imports the same constant only to
 * show the visitor what they will pay; a mismatch would be a display bug,
 * never an incorrect charge.
 */
export const ONLINE_PAYMENT_DISCOUNT = 0;

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
