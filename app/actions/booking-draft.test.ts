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
 * And `updateDraftBookingMeta`, which writes how the draft is paid: since
 * 2026-11-24 always the whole price, whatever an old form sends.
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
/** What an UPDATE that is awaited without a `select` wrote (the draft's meta). */
let metaWrites: Record<string, unknown>[] = [];
let tier: { price_eur: number | null; price_center_eur: number | null } | null =
  null;

function serviceTiers() {
  const chain = {
    select: () => chain,
    eq: () => chain,
    limit: () => Promise.resolve({ data: tier ? [tier] : [], error: null }),
  };
  return chain;
}

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
    then(ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) {
      if (patch) metaWrites.push(patch);
      return Promise.resolve({ data: null, error: null }).then(ok, bad);
    },
  };
  return chain;
}

const real = {
  admin: { ...(await import("@/lib/insforge-admin")) },
  record: { ...(await import("@/lib/booking-events/record")) },
};

let confirmDraftBooking: typeof import("@/actions/booking-draft").confirmDraftBooking;
let updateDraftBookingMeta: typeof import("@/actions/booking-draft").updateDraftBookingMeta;

beforeAll(async () => {
  mock.module("@/lib/insforge-admin", () => ({
    ...real.admin,
    getAdminClient: () => ({
      database: {
        from: (table: string) =>
          table === "service_tiers" ? serviceTiers() : bookings(),
      },
    }),
  }));
  mock.module("@/lib/booking-events/record", () => ({
    ...real.record,
    recordBookingEvent: async (event: Record<string, unknown>) => {
      events.push(event);
    },
  }));
  ({ confirmDraftBooking, updateDraftBookingMeta } =
    await import("@/actions/booking-draft"));
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
  metaWrites = [];
  tier = null;
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

describe("updateDraftBookingMeta writes a draft paid in full", () => {
  test("at the web price of the tier, with the note the staff read", async () => {
    tier = { price_eur: 130, price_center_eur: 140 };
    await updateDraftBookingMeta("b-1", "tier-1", 60, null, "anonymous", null);
    expect(metaWrites).toHaveLength(1);
    expect(metaWrites[0]).toMatchObject({
      payment_mode: "full",
      price_eur: 130,
      notes: "Pago: 100% online al reservar",
    });
  });

  test("a page still open on the old form that asks for a deposit gets a draft paid in full", async () => {
    tier = { price_eur: 130, price_center_eur: 140 };
    // The old form sent an eighth argument, "deposit". It is not read.
    const oldCall = updateDraftBookingMeta as (
      ...args: unknown[]
    ) => Promise<void>;
    await oldCall(
      "b-1",
      "tier-1",
      60,
      null,
      "anonymous",
      "Nota",
      null,
      "deposit",
    );
    expect(metaWrites[0]).toMatchObject({
      payment_mode: "full",
      price_eur: 130,
      notes: "Pago: 100% online al reservar\n\nNota",
    });
    expect(JSON.stringify(metaWrites)).not.toMatch(/deposit|dep[oó]sito/i);
  });
});
