import { CANCELLATION_WINDOW_HOURS } from "@/constants/booking";

/**
 * What cancelling a session drawn from a bonus does with that session (the
 * owner's rule of 2026-11-24, Terms 3.4).
 *
 * At least 24 hours before the session (in the Canaries' own time,
 * `hoursUntilSession`), whoever cancels, it goes back to the bonus. Inside the
 * last 24 hours, or a no-show, it is LOST: the bonus counts it as used. A client
 * cannot cancel that late by link (the link refuses), so a late cancellation is
 * the team's, and the team decides: lost unless they tick "Devolver la sesión
 * al bono" (a centre's own cancellation, say).
 *
 * Nothing on the booking row says it: the history does. A `bonus_lost` entry
 * keeps the cancelled session counted; a later `bonus_returned` (or no entry at
 * all, as for every cancellation before this rule) gives it back. The latest
 * word decides, so a session lost, reactivated and cancelled again in time goes
 * back to the bonus.
 */

export const BONUS_RETURNED = "bonus_returned";
export const BONUS_LOST = "bonus_lost";

export type BonusCancelReason =
  /** At least 24 hours before: the session goes back to the bonus. */
  | "in_advance"
  /** Inside the last 24 hours (or after the session): the session is lost. */
  | "late"
  /** Inside the last 24 hours, and the team gave it back all the same. */
  | "late_team_returns";

export function bonusOnCancel(input: {
  hoursBefore: number;
  by: "client" | "team";
  teamReturnsLate?: boolean;
}): { returned: boolean; reason: BonusCancelReason } {
  if (input.hoursBefore >= CANCELLATION_WINDOW_HOURS) {
    return { returned: true, reason: "in_advance" };
  }
  if (input.by === "team" && input.teamReturnsLate === true) {
    return { returned: true, reason: "late_team_returns" };
  }
  return { returned: false, reason: "late" };
}

/**
 * The bookings whose session is lost: their LATEST `bonus_lost` /
 * `bonus_returned` entry is `bonus_lost`. Entries in any order.
 */
export function lostBookingIds(
  entries: { booking_id: string | null; event: string; created_at: string }[],
): Set<string> {
  const latest = new Map<string, { event: string; at: string }>();
  for (const e of entries) {
    if (!e.booking_id) continue;
    if (e.event !== BONUS_LOST && e.event !== BONUS_RETURNED) continue;
    const seen = latest.get(e.booking_id);
    if (!seen || e.created_at >= seen.at) {
      latest.set(e.booking_id, { event: e.event, at: e.created_at });
    }
  }
  return new Set(
    [...latest.entries()]
      .filter(([, word]) => word.event === BONUS_LOST)
      .map(([id]) => id),
  );
}

/**
 * The status a bonus session counts with: a cancelled booking whose session
 * was lost counts as `lost` (used); every other keeps its own.
 */
export function useStatus(
  booking: { id: string; status: string | null },
  lost: Set<string>,
): string {
  return booking.status === "cancelled" && lost.has(booking.id)
    ? "lost"
    : (booking.status ?? "");
}
