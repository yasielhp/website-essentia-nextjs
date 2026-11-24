import { CANCELLATION_WINDOW_HOURS } from "@/constants/booking";
import { canaryWallClockToUtc } from "@/lib/campaigns/visit-time";

/**
 * When a session starts, and how far away that is.
 *
 * A booking stores its day and its hour as the wall clock in the Canaries
 * (`2026-07-15` + `10:00`), with no zone. Read with the server's own clock
 * (`new Date("2026-07-15T10:00:00")`) the same row meant 10:00 UTC on Vercel,
 * which in summer is 11:00 in the Canaries: the 24-hour limit closed an hour
 * late and a client could cancel, and be promised a refund, 23 hours before.
 * Every reading here goes through Atlantic/Canary, winter and summer, and gives
 * the same answer on any server.
 */

/** The instant the session starts, or null when the booking has no day. */
export function sessionStartsAt(
  date: string | null | undefined,
  time: string | null | undefined,
): Date | null {
  if (!date) return null;
  const day = date.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  // A booking with no hour starts at the first moment of its day, as the
  // appointment notices read it.
  const clock = time && /^\d{1,2}:\d{2}/.test(time) ? time : "00:00";
  const start = canaryWallClockToUtc(day, clock);
  return Number.isNaN(start.getTime()) ? null : start;
}

/**
 * Hours from `now` to the start of the session; negative once it has begun,
 * and -1 for a booking with no day, which therefore reads as LATE: the client
 * cannot cancel it by link, and a cancellation of it owes no refund unless the
 * team decides otherwise.
 */
export function hoursUntilSession(
  date: string | null | undefined,
  time: string | null | undefined,
  now: number = Date.now(),
): number {
  const start = sessionStartsAt(date, time);
  if (!start) return -1;
  return (start.getTime() - now) / 3_600_000;
}

/**
 * True while the session is at least 24 hours away: the client may still
 * cancel on their own, and money paid online is refunded. Exactly 24 hours
 * before still counts ("up to 24 hours before").
 */
export function isOutsideCancellationWindow(
  date: string | null | undefined,
  time: string | null | undefined,
  now: number = Date.now(),
): boolean {
  return hoursUntilSession(date, time, now) >= CANCELLATION_WINDOW_HOURS;
}
