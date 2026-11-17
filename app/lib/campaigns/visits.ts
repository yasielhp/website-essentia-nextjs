import { parseDurationMinutes } from "@/utils/format";
import type { Appointment, VisitInfo } from "./audience-filter";
import { canaryWallClockToUtc, visitEndsAtIso } from "./visit-time";

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

// ── appointments, for the notices that count hours around each booking ─────

export type AppointmentBooking = VisitBooking & {
  service_id: string | null;
};

/**
 * Every confirmed or completed booking of one contact, as an appointment: its
 * start and end as instants and what a message says about it. Pure.
 *
 * - Anything else (cancelled, pending, a draft, no status) is not an
 *   appointment, and neither is a booking with no date.
 * - The start is the Canary wall clock of the date and time the booking was
 *   saved with, converted once here (`new Date(date + "T" + time)` would read
 *   it in the server's zone). A booking with no time starts at the day's first
 *   moment and says no time.
 * - A booking with no length ends when it starts; the first-visit rule's
 *   60-minute fallback is not applied to a notice, which would otherwise be
 *   timed from a length nobody chose.
 * - Ordered by start and, at the same moment, by id, so the result does not
 *   depend on the order the rows were read in.
 */
export function foldAppointments(
  bookings: AppointmentBooking[],
  tierLabels: ReadonlyMap<string, string> = new Map(),
): Appointment[] {
  const out: Appointment[] = [];
  for (const booking of bookings) {
    if (booking.status !== "confirmed" && booking.status !== "completed") {
      continue;
    }
    if (!booking.date) continue;
    const date = booking.date.slice(0, 10);
    const time = clockOf(booking.time);
    const start = canaryWallClockToUtc(date, time || "00:00");
    if (Number.isNaN(start.getTime())) continue;
    const minutes = booking.duration?.trim()
      ? parseDurationMinutes(booking.duration)
      : 0;
    out.push({
      id: booking.id,
      serviceId: booking.service_id ?? null,
      status: booking.status,
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + minutes * 60_000).toISOString(),
      visit: {
        service: booking.service_title ?? "",
        sessionType: booking.tier_id
          ? (tierLabels.get(booking.tier_id) ?? null)
          : null,
        date,
        time,
      },
    });
  }
  return out.sort(
    (a, b) =>
      a.startsAt.localeCompare(b.startsAt) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}
