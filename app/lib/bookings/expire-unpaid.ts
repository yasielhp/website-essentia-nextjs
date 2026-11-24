/**
 * When a web booking that never got paid stops holding its slot.
 *
 * Pure so the rule is tested on its own; `run-expire-unpaid.ts` applies it.
 */

/** How long a client has to finish paying before the slot is released. */
export const UNPAID_EXPIRY_MS = 30 * 60 * 1000;

export type ExpirableBooking = {
  status: string | null;
  payment_status: string | null;
  /** Set by the checkout and the public form; null on bookings from before deposits. */
  payment_mode: string | null;
  created_by_role: string | null;
  created_at: string | null;
};

/** The later of two instants, ignoring what is missing or unreadable. */
function latest(...values: (string | null | undefined)[]): number | null {
  const times = values
    .map((v) => (v ? new Date(v).getTime() : Number.NaN))
    .filter((t) => !Number.isNaN(t));
  return times.length > 0 ? Math.max(...times) : null;
}

/**
 * True for a web booking that is still `pending`, has taken no money — the bank
 * never answered, or refused the card — and is older than the expiry window.
 *
 * The window runs from the LAST time its payment was opened (`lastCheckoutAt`,
 * the newest `payment/checkout` entry of its history) when there is one, not
 * from when the form started the booking: a visitor who took twenty minutes
 * over the calendar and then went to the bank must not lose the hour while
 * she is typing her card.
 *
 * Requiring `payment_mode` keeps this away from bookings made before deposits,
 * which waited unpaid for the centre to confirm them and are not abandoned.
 * Bookings from the dashboard are never touched: they are `confirmed` and made
 * by staff.
 */
export function isExpiredUnpaid(
  booking: ExpirableBooking,
  now: Date,
  lastCheckoutAt: string | null = null,
): boolean {
  if (booking.status !== "pending") return false;
  if (
    booking.payment_status !== "pending" &&
    booking.payment_status !== "failed"
  ) {
    return false;
  }
  if (booking.payment_mode !== "deposit" && booking.payment_mode !== "full") {
    return false;
  }
  if (
    booking.created_by_role !== "client" &&
    booking.created_by_role !== "anonymous"
  ) {
    return false;
  }
  if (!booking.created_at) return false;
  const since = latest(booking.created_at, lastCheckoutAt);
  if (since === null) return false;
  return now.getTime() - since > UNPAID_EXPIRY_MS;
}
