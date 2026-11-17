import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";

/**
 * `confirmDraftBooking`, run for real with the database and the booking
 * history replaced. What is under test is its ANSWER: the public form opens
 * the payment on it, so it must say whether this call is the one that turned
 * the draft into a booking, and why not when it is not.
 *
 * Modules are put back afterwards: `mock.module` is process-wide.
 */

type Row = { id: string; status: string; service_title: string } | null;

let row: Row = null;
/** Runs between the read and the write: where another tab can get in first. */
let beforeWrite: (() => void) | null = null;
let failOn: "read" | "write" | null = null;
let updates: Record<string, unknown>[] = [];
let events: Record<string, unknown>[] = [];

function bookings() {
  const filters: [string, unknown][] = [];
  let patch: Record<string, unknown> | null = null;
  const matches = () =>
    row !== null &&
    filters.every(
      ([col, value]) => (row as Record<string, unknown>)[col] === value,
    );
  const chain = {
    select() {
      if (!patch) return chain;
      if (failOn === "write") {
        return Promise.resolve({ data: null, error: { message: "boom" } });
      }
      beforeWrite?.();
      if (!matches()) return Promise.resolve({ data: [], error: null });
      updates.push(patch);
      Object.assign(row as object, patch);
      return Promise.resolve({ data: [{ id: row!.id }], error: null });
    },
    update(p: Record<string, unknown>) {
      patch = p;
      return chain;
    },
    eq(col: string, value: unknown) {
      filters.push([col, value]);
      return chain;
    },
    maybeSingle: () =>
      failOn === "read"
        ? Promise.resolve({ data: null, error: { message: "boom" } })
        : Promise.resolve({ data: matches() ? { ...row } : null, error: null }),
  };
  return chain;
}

const real = {
  admin: { ...(await import("@/lib/insforge-admin")) },
  record: { ...(await import("@/lib/booking-events/record")) },
};

let confirmDraftBooking: typeof import("@/actions/booking-draft").confirmDraftBooking;

beforeAll(async () => {
  mock.module("@/lib/insforge-admin", () => ({
    ...real.admin,
    getAdminClient: () => ({ database: { from: bookings } }),
  }));
  mock.module("@/lib/booking-events/record", () => ({
    ...real.record,
    recordBookingEvent: async (event: Record<string, unknown>) => {
      events.push(event);
    },
  }));
  ({ confirmDraftBooking } = await import("@/actions/booking-draft"));
});

afterAll(() => {
  mock.module("@/lib/insforge-admin", () => real.admin);
  mock.module("@/lib/booking-events/record", () => real.record);
});

beforeEach(() => {
  row = { id: "b-1", status: "draft", service_title: "Drenaje" };
  beforeWrite = null;
  failOn = null;
  updates = [];
  events = [];
});

const confirm = (id = "b-1") =>
  confirmDraftBooking(id, "tier-1", 60, "60 min", "2099-08-20", "10:30");

describe("confirmDraftBooking says whether it was the one that confirmed", () => {
  test("a draft is promoted to pending, once, and it says so", async () => {
    expect(await confirm()).toEqual({ promoted: true });
    expect(row?.status).toBe("pending");
    expect(updates).toHaveLength(1);
    expect(events).toHaveLength(1);
  });

  test("a booking that is no longer a draft is left alone, and it says that too", async () => {
    for (const status of ["pending", "confirmed", "completed", "cancelled"]) {
      row = { id: "b-1", status, service_title: "Drenaje" };
      expect(await confirm()).toEqual({ promoted: false, reason: "not_draft" });
      expect(row.status).toBe(status);
    }
    expect(updates).toEqual([]);
    expect(events).toEqual([]);
  });

  test("the second of two calls is the one that did not confirm", async () => {
    expect(await confirm()).toEqual({ promoted: true });
    expect(await confirm()).toEqual({ promoted: false, reason: "not_draft" });
    expect(events).toHaveLength(1);
  });

  test("another tab that gets in between the read and the write wins: nothing is recorded twice", async () => {
    beforeWrite = () => {
      row!.status = "pending";
    };
    expect(await confirm()).toEqual({ promoted: false, reason: "not_draft" });
    expect(updates).toEqual([]);
    expect(events).toEqual([]);
  });

  test("a draft that is not there any more is 'missing', not 'already confirmed'", async () => {
    row = null;
    expect(await confirm()).toEqual({ promoted: false, reason: "missing" });
    expect(await confirm("")).toEqual({ promoted: false, reason: "missing" });
    expect(events).toEqual([]);
  });

  test("a database that cannot be read or written is 'failed': nothing is concluded about the booking", async () => {
    for (const where of ["read", "write"] as const) {
      failOn = where;
      const answer = await confirm();
      expect(answer).toEqual({ promoted: false, reason: "failed" });
      expect(JSON.stringify(answer)).not.toContain("boom");
    }
    expect(row?.status).toBe("draft");
    expect(events).toEqual([]);
  });
});
