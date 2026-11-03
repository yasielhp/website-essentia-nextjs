import { effectivePayment } from "@/lib/payments/amounts";

/**
 * How the transactions ledger reads a booking, and how it adds a list up.
 *
 * It lives here, not in the dashboard page, because two things read the money
 * and they must agree to the cent: the transactions screen and the MCP tool
 * that reports on it.
 */

export type LedgerBooking = {
  status: string | null;
  payment_status: string | null;
  payment_mode: string | null;
  price_eur: number | string | null;
  amount_paid_eur: number | string | null;
};

export type LedgerMoney = {
  /** Money received; for older bookings, the price they were booked at. */
  amount: number | null;
  /** The agreed price when it differs from what was received (a deposit). */
  listAmount?: number | null;
  /** Still to collect at the centre. */
  owed?: number;
  status: string | null;
};

/**
 * What a booking is worth in the ledger, and its payment state.
 *
 * Rows with a `payment_mode` were booked after deposits existed, so the money
 * is `amount_paid_eur`. Older rows (confirmed bookings whose payment_status is
 * still `pending`) keep the old reading — confirmed and not failed or refunded
 * counts as completed at its price — or the history of income would fall to
 * almost nothing.
 */
export function bookingMoney(r: LedgerBooking): LedgerMoney {
  const price = r.price_eur == null ? null : Number(r.price_eur);
  const pay = effectivePayment(r);
  if (r.payment_mode === null) {
    return {
      amount: price,
      status:
        pay.status === "paid" ? "completed" : (r.payment_status ?? r.status),
    };
  }
  const status =
    pay.status === "paid"
      ? "completed"
      : pay.status === "deposit_paid" ||
          pay.status === "failed" ||
          pay.status === "refunded"
        ? pay.status
        : "pending";
  return {
    amount: pay.paidEur,
    listAmount: price,
    owed: pay.owedEur,
    status,
  };
}

/** The headline numbers of a list of ledger rows. */
export function ledgerTotals(
  rows: { status: string | null; amount: number | null; owed?: number }[],
): { revenue: number; owed: number; completed: number; total: number } {
  const revenue = rows
    .filter(
      (r) =>
        (r.status === "completed" || r.status === "deposit_paid") &&
        r.amount !== null,
    )
    .reduce((sum, r) => sum + (r.amount ?? 0), 0);
  return {
    revenue: Math.round(revenue * 100) / 100,
    owed:
      Math.round(rows.reduce((sum, r) => sum + (r.owed ?? 0), 0) * 100) / 100,
    completed: rows.filter((r) => r.status === "completed").length,
    total: rows.length,
  };
}
