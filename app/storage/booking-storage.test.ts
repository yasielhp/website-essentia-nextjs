import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import {
  readStorage,
  writeStorage,
  type BookingStorage,
} from "@/storage/booking-storage";

/**
 * A half-finished booking is kept in the browser so a reload does not lose it.
 * The two consent boxes are the exception: a tick is an act of the person in
 * front of the form now, and the next one to open it on that device may be
 * somebody else.
 */

const store = new Map<string, string>();
const realStorage = (globalThis as { localStorage?: Storage }).localStorage;

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  },
});

afterAll(() => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: realStorage,
  });
});

beforeEach(() => store.clear());

const SAVED: BookingStorage = {
  step: 2,
  serviceId: "manual-therapy",
  selectedTierId: "tier-1",
  selectedTierLabel: "Drenaje linfático",
  selectedTierPrice: 60,
  selectedTierPriceOnline: 55,
  selectedDuration: "60 min",
  selectedDate: "2099-08-20T00:00:00.000Z",
  selectedTime: "10:30",
  staffId: "s-1",
  staffName: "Marta",
  details: {
    firstName: "Ana",
    lastName: "García",
    email: "ana@example.com",
    phone: "600000000",
    gender: "female",
    consent: true,
    newsletter: true,
    notes: "Primera visita",
  },
};

describe("readStorage", () => {
  test("a restored booking comes back with both consent boxes unticked", () => {
    writeStorage(SAVED);
    const restored = readStorage();
    expect(restored.details?.consent).toBe(false);
    expect(restored.details?.newsletter).toBe(false);
  });

  test("everything else is restored as it was saved", () => {
    writeStorage(SAVED);
    expect(readStorage()).toEqual({
      ...SAVED,
      details: { ...SAVED.details, consent: false, newsletter: false },
    });
  });

  test("nothing saved, or something unreadable, is an empty restore", () => {
    expect(readStorage()).toEqual({});
    store.set("essentia_booking:v1", "{not json");
    expect(readStorage()).toEqual({});
  });

  test("a saved booking with no details yet stays without them", () => {
    store.set("essentia_booking:v1", JSON.stringify({ step: 1 }));
    expect(readStorage()).toEqual({ step: 1 });
  });
});
