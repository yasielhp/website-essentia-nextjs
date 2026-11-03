/**
 * Rules for a bonus bought on the public site, kept pure so they can be tested
 * without a bank in the loop.
 */

/** Euros as the bank counts them. */
export function toCents(eur: number): number {
  return Math.round(eur * 100);
}

/**
 * A Redsys order number for a bonus.
 *
 * Redsys wants 4 to 12 characters, the first four digits. Bookings use twelve
 * digits taken from the clock; a bonus has a `B` in it, so a bonus order can
 * never equal a booking's and the webhook can look the two up in turn without
 * ever confusing them.
 */
export function bonusOrderId(
  now: Date = new Date(),
  random: () => number = Math.random,
): string {
  const clock = String(now.getTime()).slice(-8);
  const salt = String(Math.floor(random() * 1000)).padStart(3, "0");
  return `${clock}B${salt}`;
}

export type GrantDecision =
  { grant: true } | { grant: false; reason: "not_pending" | "amount_mismatch" };

/**
 * Whether a payment notification should turn an order into a bonus.
 *
 * Only a `pending` order does, so a retried notification cannot make a second
 * bonus; and only when the bank collected exactly the order's price, so a
 * bonus is never handed over for less than it is worth.
 */
export function shouldGrantBonus(
  order: { status: string; priceEur: number },
  amountCents: number,
): GrantDecision {
  if (order.status !== "pending")
    return { grant: false, reason: "not_pending" };
  if (
    !Number.isFinite(amountCents) ||
    amountCents !== toCents(order.priceEur)
  ) {
    return { grant: false, reason: "amount_mismatch" };
  }
  return { grant: true };
}
