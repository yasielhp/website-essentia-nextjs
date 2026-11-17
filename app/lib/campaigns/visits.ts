import type { VisitInfo } from "./audience-filter";
import { visitEndsAtIso } from "./visit-time";

/**
 * The visits of one contact that a message talks about, picked out of their
 * bookings. Pure, so the choice (which one is "the last", which "the first",
 * and what breaks a tie) is tested rather than left to the order rows arrive.
 */

export type VisitBooking = {
  /** Breaks a tie: with equal date and time the lowest id wins, every time. */
  id: string;
  service_title: string | null;
  tier_id: string | null;
  /** Nullable in the live table: a booking without a date is left out. */
  date: string | null;
  time: string | null;
  duration: string | null;
  status: string | null;
};

export type FoldedVisits = {
  /** The latest non-cancelled booking, by date then time. */
  lastVisit: VisitInfo | null;
  /** The confirmed or completed booking that ends earliest. */
  firstVisit: VisitInfo | null;
  /** The same, per session type; a type without a visit has no key. */
  firstVisitByTier: Record<string, VisitInfo>;
  /** ISO end of `firstVisit`, which the `first_visit` rule waits for. */
  firstVisitEndsAt: string | null;
  firstVisitEndsAtByTier: Record<string, string>;
};

/** `09:30:00` and `09:30` are the same time; this is the only place it is cut. */
const clockOf = (time: string | null) => (time ?? "").slice(0, 5);

type Pick<T> = { key: T; id: string; visit: VisitInfo };

/** Whether a candidate replaces the current pick: strictly better, or equal with a lower id. */
function wins<T extends string>(
  candidate: Pick<T>,
  current: Pick<T> | undefined,
  better: (a: T, b: T) => boolean,
): boolean {
  if (!current) return true;
  if (better(candidate.key, current.key)) return true;
  return candidate.key === current.key && candidate.id < current.id;
}

export function foldVisits(
  bookings: VisitBooking[],
  tierLabels: ReadonlyMap<string, string> = new Map(),
): FoldedVisits {
  let last: Pick<string> | undefined;
  let first: Pick<string> | undefined;
  const firstByTier = new Map<string, Pick<string>>();

  for (const booking of bookings) {
    if (booking.status === "cancelled" || !booking.date) continue;
    const date = booking.date.slice(0, 10);
    const time = clockOf(booking.time);
    const visit: VisitInfo = {
      service: booking.service_title ?? "",
      sessionType: booking.tier_id
        ? (tierLabels.get(booking.tier_id) ?? null)
        : null,
      date,
      time,
    };

    const lastCandidate = { key: `${date} ${time}`, id: booking.id, visit };
    if (wins(lastCandidate, last, (a, b) => a > b)) last = lastCandidate;

    // Only visits that really happened (or will) start the post-visit flow.
    if (booking.status !== "confirmed" && booking.status !== "completed") {
      continue;
    }
    const endsAt = visitEndsAtIso(booking.date, booking.time, booking.duration);
    if (!endsAt) continue;
    const firstCandidate = { key: endsAt, id: booking.id, visit };
    const earlier = (a: string, b: string) => a < b;
    if (wins(firstCandidate, first, earlier)) first = firstCandidate;
    if (booking.tier_id) {
      const current = firstByTier.get(booking.tier_id);
      if (wins(firstCandidate, current, earlier)) {
        firstByTier.set(booking.tier_id, firstCandidate);
      }
    }
  }

  return {
    lastVisit: last?.visit ?? null,
    firstVisit: first?.visit ?? null,
    firstVisitByTier: Object.fromEntries(
      [...firstByTier].map(([tier, pick]) => [tier, pick.visit]),
    ),
    firstVisitEndsAt: first?.key ?? null,
    firstVisitEndsAtByTier: Object.fromEntries(
      [...firstByTier].map(([tier, pick]) => [tier, pick.key]),
    ),
  };
}
