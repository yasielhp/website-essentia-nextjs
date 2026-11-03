/**
 * Whether a booking still keeps its hour out of the public calendar.
 *
 * Pure so the rule is tested on its own; `availability.ts` applies it.
 */

/** How long a draft — a form somebody is still filling in — holds its hour. */
export const DRAFT_HOLD_MS = 60 * 60 * 1000;

export type SlotHolder = {
  status: string | null;
  created_at: string | null;
};

/**
 * A draft is the form in progress: it holds the hour so two visitors cannot
 * pick the same one at once. But a form abandoned at the date step would hold
 * it for ever, since nothing ever cancels a draft — so an old one lets go.
 * Cancelled bookings never hold anything; every other status does.
 */
export function holdsSlot(booking: SlotHolder, now: Date): boolean {
  if (booking.status === "cancelled") return false;
  if (booking.status !== "draft") return true;
  if (!booking.created_at) return false;
  const created = new Date(booking.created_at).getTime();
  if (Number.isNaN(created)) return false;
  return now.getTime() - created <= DRAFT_HOLD_MS;
}
