import type { DetailsState } from "@/types";

const STORAGE_KEY = "essentia_booking";

export type BookingStorage = {
  step: number;
  serviceId: string | null;
  selectedTierId: string | null;
  selectedTierPrice: number | null;
  selectedDuration: string | null;
  selectedDate: string | null;
  selectedTime: string | null;
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
