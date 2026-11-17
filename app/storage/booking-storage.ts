import type { DetailsState } from "@/types";
import { DRAFT_HOLD_MS } from "@/lib/bookings/holds-slot";

/**
 * The `:v1` is the contract, not decoration.
 *
 * A half-finished booking outlives a deploy. Bump it whenever the shape below
 * changes and every session written by the old shape simply stops being found,
 * instead of coming back as the new type and resuming on a step that no longer
 * means what it did.
 */
const STORAGE_KEY = "essentia_booking:v1";

export type BookingStorage = {
  step: number;
  serviceId: string | null;
  selectedTierId: string | null;
  /** The treatment's name — the confirm step shows it, so it has to survive a reload. */
  selectedTierLabel: string | null;
  selectedTierPrice: number | null;
  selectedTierPriceOnline: number | null;
  selectedDuration: string | null;
  selectedDate: string | null;
  selectedTime: string | null;
  /** The member of staff the visitor picked, if the session type has any. */
  staffId: string | null;
  staffName: string | null;
  details: DetailsState;
  /**
   * The draft this visit started on the server, and when. Kept so that a
   * reload goes on with the SAME draft: a second one would leave the first
   * behind holding the hour she had picked, and she would find her own hour
   * taken. Optional, so a booking saved before this existed still reads.
   */
  draft?: { bookingId: string; startedAt: number } | null;
};

/**
 * The draft a restored booking goes on with, or null.
 *
 * Only for as long as a draft holds its hour (`DRAFT_HOLD_MS`). Past that the
 * old draft holds nothing, so there is nothing to protect by reusing it, and a
 * fresh one holds the hour again while she finishes. Whatever is in storage is
 * checked rather than trusted: it is the browser's.
 */
export function resumableDraft(
  saved: Partial<BookingStorage>,
  now: number = Date.now(),
): { bookingId: string; startedAt: number } | null {
  const draft: unknown = saved.draft;
  if (!draft || typeof draft !== "object") return null;
  const { bookingId, startedAt } = draft as Record<string, unknown>;
  if (typeof bookingId !== "string" || bookingId === "") return null;
  if (typeof startedAt !== "number" || !Number.isFinite(startedAt)) return null;
  const age = now - startedAt;
  if (age < 0 || age > DRAFT_HOLD_MS) return null;
  return { bookingId, startedAt };
}

/**
 * What an abandoned booking left behind, for the form to pick up again.
 *
 * The two consent boxes never come back ticked. A tick is an act of whoever is
 * in front of the form now, and the next person to open it on this device may
 * be somebody else: accepting the Terms and asking for news and offers are
 * hers to do, not something a previous visit can do for her.
 */
export function readStorage(): Partial<BookingStorage> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const saved = JSON.parse(raw) as Partial<BookingStorage>;
    if (!saved.details) return saved;
    return {
      ...saved,
      details: { ...saved.details, consent: false, newsletter: false },
    };
  } catch {
    return {};
  }
}

export function writeStorage(data: BookingStorage) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

export function clearStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
