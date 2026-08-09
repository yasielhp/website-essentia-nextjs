import type { DetailsState } from "@/types";

const STORAGE_KEY = "essentia_booking";

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
