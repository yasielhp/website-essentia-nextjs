/**
 * Paying online versus paying at the centre.
 *
 * The discount is no longer a single site-wide rate: each session type carries
 * its own two prices in `service_tiers` — `price_eur` for the website and
 * `price_center_eur` for the counter — and the difference between them *is*
 * the discount. Changing it is editing a price in the dashboard, which is the
 * point: the centre can move one treatment without touching the rest.
 *
 * The authority on the amount charged is still the server:
 * `/api/checkout/booking-session` reads both prices from the table and never
 * takes an amount from the request.
 */

/** What the visitor saves by paying online, or 0 when there is no discount. */
export function onlineSaving(
  centrePriceEur: number | null,
  onlinePriceEur: number | null,
): number {
  if (centrePriceEur == null || onlinePriceEur == null) return 0;
  const saving = centrePriceEur - onlinePriceEur;
  return saving > 0 ? Math.round(saving * 100) / 100 : 0;
}

/** The same saving as a percentage, for copy like "−20%". */
export function onlineDiscountPercent(
  centrePriceEur: number | null,
  onlinePriceEur: number | null,
): number {
  const saving = onlineSaving(centrePriceEur, onlinePriceEur);
  if (!saving || !centrePriceEur) return 0;
  return Math.round((saving / centrePriceEur) * 100);
}
