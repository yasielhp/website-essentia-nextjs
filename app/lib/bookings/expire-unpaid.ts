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

/**
 * True for a web booking that is still `pending`, has taken no money, and is
 * older than the expiry window.
 *
 * Requiring `payment_mode` keeps this away from bookings made before deposits,
 * which waited unpaid for the centre to confirm them and are not abandoned.
 * Bookings from the dashboard are never touched: they are `confirmed` and made
 * by staff.
 */
export function isExpiredUnpaid(booking: ExpirableBooking, now: Date): boolean {
  if (booking.status !== "pending") return false;
  if (booking.payment_status !== "pending") return false;
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
  const created = new Date(booking.created_at).getTime();
  if (Number.isNaN(created)) return false;
  return now.getTime() - created > UNPAID_EXPIRY_MS;
}
