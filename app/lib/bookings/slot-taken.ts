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

/**
 * Whether a database error is the professional's hour being taken: Postgres'
 * code for an exclusion violation, or the constraint's name wherever PostgREST
 * or a wrapper put it (the message, the details, the hint).
 */
export function isSlotTaken(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { code, message, details, hint } = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
    hint?: unknown;
  };
  if (code === "23P01") return true;
  return [message, details, hint].some(
    (text) => typeof text === "string" && text.includes(NO_OVERLAP_CONSTRAINT),
  );
}
