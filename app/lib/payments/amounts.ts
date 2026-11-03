/**
 * How much to charge at booking time, and what the booking is worth after.
 *
 * Pure so the checkout route, the public confirm step and the dashboard all
 * agree on the number. The server remains the authority: the route reads the
 * list price from `service_tiers` and the settings from `app_settings`, never
 * from the request.
 */

export type PaymentMode = "deposit" | "full";

export type PaymentSettings = {
  /** Share of the list price taken at booking when the client picks "deposit". */
  depositPercent: number;
  /** Discount on the list price when the client pays everything at booking. 0 disables it. */
  fullPaymentDiscountPercent: number;
  /** When false the public form books without paying. Kept for an emergency switch. */
  requirePayment: boolean;
};

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  depositPercent: 50,
  fullPaymentDiscountPercent: 5,
  requirePayment: true,
};

const toCents = (eur: number) => Math.round(eur * 100);
const fromCents = (cents: number) => cents / 100;

export function chargeForMode(
  listPriceEur: number,
  mode: PaymentMode,
  settings: PaymentSettings,
): { chargeEur: number; finalPriceEur: number } {
  if (!Number.isFinite(listPriceEur) || listPriceEur <= 0) {
    throw new Error("listPriceEur must be positive");
  }
  const list = toCents(listPriceEur);
  if (mode === "full") {
    const discounted = Math.round(
      list * (1 - settings.fullPaymentDiscountPercent / 100),
    );
    return {
      chargeEur: fromCents(discounted),
      finalPriceEur: fromCents(discounted),
    };
  }
  const deposit = Math.round(list * (settings.depositPercent / 100));
  return { chargeEur: fromCents(deposit), finalPriceEur: fromCents(list) };
}

export function paymentStatusAfter(
  paidEur: number,
  priceEur: number,
): "pending" | "deposit_paid" | "paid" {
  if (paidEur <= 0) return "pending";
  return toCents(paidEur) >= toCents(priceEur) ? "paid" : "deposit_paid";
}

export function amountOwed(
  priceEur: number | null,
  paidEur: number | null,
): number {
  const owed = toCents(priceEur ?? 0) - toCents(paidEur ?? 0);
  return owed > 0 ? fromCents(owed) : 0;
}
