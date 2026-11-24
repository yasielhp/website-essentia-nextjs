/**
 * The database's refusal of a second booking on a professional's taken hour.
 *
 * `bookings_no_overlap` (migration `20261124_bookings_no_overlap.sql`) is an
 * exclusion constraint: two bookings of the same professional whose hours
 * overlap cannot both hold their slot (every status but `draft` and
 * `cancelled`). It is the only check that closes the race of two visitors
 * confirming the same hour at once: the calendar's free hours and a draft's
 * hold (`holds-slot.ts`) are courtesy, read a moment before somebody else
 * writes.
 *
 * Postgres answers `23P01` (exclusion_violation) and PostgREST passes the code
 * through; the constraint's name is in the message. Either is enough.
 *
 * Pure, so every writer maps it the same way and a test can pin it.
 */

/** What a writer answers when the hour is taken. */
export const SLOT_TAKEN = "slot_taken";

/** The name of the constraint, as the migration creates it. */
export const NO_OVERLAP_CONSTRAINT = "bookings_no_overlap";

/** Whether a database error is the professional's hour being taken. */
export function isSlotTaken(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (code === "23P01") return true;
  return typeof message === "string" && message.includes(NO_OVERLAP_CONSTRAINT);
}
