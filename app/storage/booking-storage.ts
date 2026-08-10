import type { DetailsState } from "@/types";

const STORAGE_KEY = "essentia_booking";

/**
 * Bumped whenever the shape below changes.
 *
 * A half-finished booking outlives a deploy. Without a version, a saved
 * session written by the previous shape came back as the new type and the
 * flow resumed on a step that no longer meant the same thing — so the visitor
 * met a form filled with nothing, or with the wrong thing.
 */
const STORAGE_VERSION = 1;

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
};

export function readStorage(): Partial<BookingStorage> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { version?: number } & BookingStorage;
    // Written by an older shape: start clean rather than resume half of it.
    if (parsed.version !== STORAGE_VERSION) return {};
    return parsed;
  } catch {
    return {};
  }
}

export function writeStorage(data: BookingStorage) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...data, version: STORAGE_VERSION }),
    );
  } catch {}
}

export function clearStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
