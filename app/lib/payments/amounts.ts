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
};

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  depositPercent: 50,
  fullPaymentDiscountPercent: 5,
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

/**
 * What a booking's payment looks like to the people reading it.
 *
 * Rows with a `payment_mode` were booked after deposits existed: the columns
 * are the truth. Older rows (`payment_mode` null) never recorded a payment, so
 * a confirmed one that did not fail or get refunded is read as settled at its
 * price — the same reading the transactions page has always used. Without it
 * the sheet and the detail page showed "pending" for bookings the ledger
 * counted as paid.
 */
export function effectivePayment(b: {
  status: string | null;
  payment_status: string | null;
  payment_mode: string | null;
  price_eur: number | string | null;
  amount_paid_eur: number | string | null;
}): { status: string; paidEur: number; owedEur: number } {
  const price = b.price_eur == null ? 0 : Number(b.price_eur);
  const paid = Number(b.amount_paid_eur ?? 0);

  if (b.payment_mode === null) {
    const settled =
      b.payment_status === "paid" ||
      ((b.status === "confirmed" || b.status === "completed") &&
        b.payment_status !== "failed" &&
        b.payment_status !== "refunded");
    return settled
      ? { status: "paid", paidEur: price, owedEur: 0 }
      : { status: b.payment_status ?? "pending", paidEur: paid, owedEur: 0 };
  }
  if (b.payment_mode === "bonus" || b.status === "cancelled") {
    return { status: b.payment_status ?? "pending", paidEur: paid, owedEur: 0 };
  }
  return {
    status: b.payment_status ?? "pending",
    paidEur: paid,
    owedEur: amountOwed(price, paid),
  };
}
