import type { DetailsState } from "@/types";

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
};

export function readStorage(): Partial<BookingStorage> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as BookingStorage) : {};
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
