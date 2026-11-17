import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { initState } from "./booking-state";

/**
 * How an abandoned booking comes back. The required box of the details step IS
 * the acceptance of the Terms and the consent to the booking notices, and it is
 * never restored ticked (`readStorage`). So a booking that was left beyond that
 * step cannot come back beyond it: it would go on to the payment with the box
 * unticked and nothing asking for it again.
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

const DETAILS = {
  firstName: "Ana",
  lastName: "García",
  email: "ana@example.com",
  phone: "600000000",
  consent: true,
  newsletter: true,
  notes: "Primera visita",
};

const save = (step: number) =>
  store.set(
    "essentia_booking:v1",
    JSON.stringify({
      step,
      serviceId: "manual-therapies",
      selectedTierId: "tier-1",
      selectedTierLabel: "Drenaje",
      selectedTierPrice: 60,
      selectedTierPriceOnline: 55,
      selectedDuration: "60 min",
      selectedDate: "2099-08-20T00:00:00.000Z",
      selectedTime: "10:30",
      staffId: "s-1",
      staffName: "Marta",
      details: DETAILS,
    }),
  );

// service 0, session type 1, details 2, date and time 3, confirm 4
const DETAILS_STEP = 2;

describe("initState: resuming a booking", () => {
  test("one left on the date or the confirm step comes back on the details step", () => {
    for (const left of [3, 4]) {
      save(left);
      expect(initState({ slug: null, startStep: 0 }).step).toBe(DETAILS_STEP);
    }
  });

  test("with everything she had chosen and typed, and the two boxes unticked", () => {
    save(4);
    const state = initState({ slug: null, startStep: 0 });
    expect(state.selectedService?.id).toBe("manual-therapies");
    expect(state.selectedTierId).toBe("tier-1");
    expect(state.selectedTime).toBe("10:30");
    expect(state.selectedDate?.toISOString()).toBe("2099-08-20T00:00:00.000Z");
    expect(state.staffName).toBe("Marta");
    expect(state.details).toEqual({
      ...DETAILS,
      consent: false,
      newsletter: false,
    });
  });

  test("one left on the details step or before it comes back where it was", () => {
    for (const left of [0, 1, 2]) {
      save(left);
      expect(initState({ slug: null, startStep: 0 }).step).toBe(left);
    }
  });

  test("nothing saved starts at the beginning", () => {
    expect(initState({ slug: null, startStep: 0 }).step).toBe(0);
  });

  test("a link to a service starts where the link says, whatever was saved", () => {
    save(4);
    const state = initState({ slug: "manual-therapies", startStep: 1 });
    expect(state.step).toBe(1);
    expect(state.details.consent).toBe(false);
  });
});
