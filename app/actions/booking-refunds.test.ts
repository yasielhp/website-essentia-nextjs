import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import { formatPrice } from "@/utils/format";

/**
 * The two refund actions of the booking page, run for real with the
 * database, the session check and the history replaced: who may read and
 * mark, what marking writes, and what it refuses.
 */

let actor = { userId: "u-1", role: "admin" };
let bookingRow: Record<string, unknown> = {};
let entries: Record<string, unknown>[] = [];
let entriesError: unknown = null;
let writes: { patch: unknown; filters: [string, unknown][] }[] = [];
/** When false, the conditional UPDATE matches no row (somebody got there first). */
let writeMatches = true;
let recorded: Record<string, unknown>[] = [];

function chain(table: string): unknown {
  let patch: unknown = null;
  const filters: [string, unknown][] = [];
  const result = () => {
    if (table === "bookings" && patch !== null) {
      writes.push({ patch, filters });
      return { data: writeMatches ? [{ id: "b-1" }] : [], error: null };
    }
    if (table === "bookings") return { data: bookingRow, error: null };
    if (table === "booking_events") {
      return entriesError
        ? { data: null, error: entriesError }
        : { data: entries, error: null };
    }
    return { data: null, error: null };
  };
  const proxy: unknown = new Proxy(() => {}, {
    get(_t, prop) {
      if (prop === "then") {
        return (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) =>
          Promise.resolve(result()).then(ok, bad);
      }
      if (prop === "update") {
        return (p: unknown) => {
          patch = p;
          return proxy;
        };
      }
      if (prop === "eq") {
        return (col: string, value: unknown) => {
          filters.push([col, value]);
          return proxy;
        };
      }
      return () => proxy;
    },
    apply: () => proxy,
  });
  return proxy;
}

const real = {
  admin: { ...(await import("@/lib/insforge-admin")) },
  guard: { ...(await import("@/lib/auth-guard")) },
  record: { ...(await import("@/lib/booking-events/record")) },
};
let actions: typeof import("./booking-refunds");

beforeAll(async () => {
  mock.module("@/lib/insforge-admin", () => ({
    ...real.admin,
    getAdminClient: () => ({ database: { from: (t: string) => chain(t) } }),
  }));
  mock.module("@/lib/auth-guard", () => ({
    ...real.guard,
    requireRole: async (
      _token: string | null,
      allowed: string[] = ["admin", "staff", "partner"],
    ) => {
      if (!allowed.includes(actor.role)) {
        throw new real.guard.AuthError("Insufficient permissions", 403);
      }
      return actor;
    },
  }));
  mock.module("@/lib/booking-events/record", () => ({
    ...real.record,
    recordBookingEvent: async (e: Record<string, unknown>) => {
      recorded.push(e);
    },
  }));
  actions = await import("./booking-refunds");
});

afterAll(() => {
  mock.module("@/lib/insforge-admin", () => real.admin);
  mock.module("@/lib/auth-guard", () => real.guard);
  mock.module("@/lib/booking-events/record", () => real.record);
});

beforeEach(() => {
  actor = { userId: "u-1", role: "admin" };
  bookingRow = {
    id: "b-1",
    status: "cancelled",
    payment_status: "paid",
    payment_mode: "full",
    amount_paid_eur: "100.00",
    stripe_session_id: "790098209516",
    balance_settled_method: null,
  };
  entries = [
    {
      event: "paid",
      actor_role: "system",
      provider_id: "790098209516",
      payload: { amountEur: 100 },
      created_at: "2026-07-01T10:00:00Z",
    },
    {
      event: "refund_owed",
      actor_role: "client",
      provider_id: "790098209516",
      payload: { amountEur: 100 },
      created_at: "2026-07-10T10:00:00Z",
    },
  ];
  writes = [];
  entriesError = null;
  writeMatches = true;
  recorded = [];
});

const mark = (input: Record<string, unknown>) =>
  actions.markBookingRefunded("token", {
    bookingId: "6f1c1f5e-2a4b-4c39-9d1e-3b2f1a0c9e11",
    amountEur: 100,
    ...input,
  } as Parameters<typeof actions.markBookingRefunded>[1]);

describe("fetchBookingRefund", () => {
  test("an administrator sees the order, the debt and may mark it", async () => {
    const view = await actions.fetchBookingRefund("token", "b-1");
    expect(view).toEqual({
      orderId: "790098209516",
      onlineEur: 100,
      state: { kind: "owed", amountEur: 100 },
      unverifiedEur: 0,
      refundableEur: 100,
      canMark: true,
      duplicates: [],
      canMarkDuplicates: true,
    });
  });

  test("staff see it but may not mark it", async () => {
    actor = { userId: "u-2", role: "staff" };
    expect((await actions.fetchBookingRefund("token", "b-1"))?.canMark).toBe(
      false,
    );
  });

  test("a partner gets nothing", async () => {
    actor = { userId: "u-3", role: "partner" };
    expect(await actions.fetchBookingRefund("token", "b-1")).toBeNull();
  });
});

describe("markBookingRefunded", () => {
  test("all of it: the booking becomes refunded, on the state just read, and the history says who", async () => {
    const res = await mark({ note: "devuelto el 25" });
    expect(res).toEqual({ error: null });
    expect(writes).toHaveLength(1);
    expect(writes[0]!.patch).toEqual({
      payment_status: "refunded",
      amount_paid_eur: 100,
    });
    expect(writes[0]!.filters).toEqual([
      ["id", "6f1c1f5e-2a4b-4c39-9d1e-3b2f1a0c9e11"],
      ["status", "cancelled"],
      ["payment_status", "paid"],
      ["amount_paid_eur", 100],
    ]);
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      channel: "payment",
      event: "refunded",
      actorId: "u-1",
      actorRole: "admin",
      providerId: "790098209516",
      summary: `Reembolso hecho · ${formatPrice(100, "es")} · pedido 790098209516 · devuelto el 25`,
    });
  });

  test("part of it: the rest stays as income and the booking keeps its state", async () => {
    const res = await mark({ amountEur: 40 });
    expect(res).toEqual({ error: null });
    expect(writes[0]!.patch).toEqual({ amount_paid_eur: 60 });
    expect(String(recorded[0]!.summary)).toContain("parcial");
  });

  test("whole cents go through, 99,99 € of 100 €", async () => {
    expect(await mark({ amountEur: 99.99 })).toEqual({ error: null });
    expect(writes[0]!.patch).toEqual({ amount_paid_eur: 0.01 });
  });

  test("40 € then the last 60 €: the second records the 100 € returned in all", async () => {
    // After the first mark: the booking holds 60 €, the history has the 40 €.
    bookingRow = { ...bookingRow, amount_paid_eur: "60.00" };
    entries = [
      ...entries,
      {
        event: "refunded",
        actor_role: "admin",
        provider_id: "790098209516",
        payload: { amountEur: 40 },
        created_at: "2026-07-11T10:00:00Z",
      },
    ];
    const res = await mark({ amountEur: 60 });
    expect(res).toEqual({ error: null });
    expect(writes[0]!.patch).toEqual({
      payment_status: "refunded",
      amount_paid_eur: 100,
    });
  });

  test("never more than is left to return", async () => {
    expect(await mark({ amountEur: 150 })).toEqual({ error: "exceeds" });
    expect(writes).toEqual([]);
  });

  test("only on a cancelled booking", async () => {
    bookingRow = { ...bookingRow, status: "confirmed" };
    expect(await mark({})).toEqual({ error: "not_cancelled" });
    expect(writes).toEqual([]);
  });

  test("not twice", async () => {
    bookingRow = { ...bookingRow, payment_status: "refunded" };
    expect(await mark({})).toEqual({ error: "nothing_to_refund" });
  });

  test("nothing when nothing was paid online", async () => {
    bookingRow = {
      ...bookingRow,
      stripe_session_id: null,
      balance_settled_method: "cash",
    };
    entries = [];
    expect(await mark({})).toEqual({ error: "nothing_to_refund" });
  });

  test("a booking paid under an order with no Redsys payment on record can be marked once checked", async () => {
    entries = [];
    const view = await actions.fetchBookingRefund("token", "b-1");
    expect(view).toMatchObject({
      orderId: "790098209516",
      onlineEur: 0,
      unverifiedEur: 100,
      state: { kind: "none" },
      canMark: true,
    });
    expect(await mark({})).toEqual({ error: null });
    expect(recorded[0]).toMatchObject({ providerId: "790098209516" });
  });

  test("a history that cannot be read refuses to mark anything", async () => {
    entriesError = { message: "down" };
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    expect(await mark({})).toEqual({ error: "failed" });
    quiet.mockRestore();
    expect(writes).toEqual([]);
  });

  test("administrators only", async () => {
    actor = { userId: "u-2", role: "staff" };
    expect(await mark({})).toEqual({ error: "unauthorized" });
    expect(writes).toEqual([]);
  });

  test("refuses what the schema does not allow", async () => {
    expect(await mark({ amountEur: -5 })).toEqual({ error: "invalid" });
    expect(await mark({ amountEur: 10.005 })).toEqual({ error: "invalid" });
    expect(await mark({ amountEur: Number.NaN })).toEqual({ error: "invalid" });
    expect(await mark({ bookingId: "b-1" })).toEqual({ error: "invalid" });
    expect(await mark({ extra: true })).toEqual({ error: "invalid" });
    expect(await mark({ note: "x".repeat(501) })).toEqual({ error: "invalid" });
    expect(writes).toEqual([]);
  });

  test("somebody got there first: no entry is written", async () => {
    writeMatches = false;
    expect(await mark({})).toEqual({ error: "conflict" });
    expect(recorded).toEqual([]);
  });
});

describe("markBookingRefunded, a duplicate payment", () => {
  const Y = "790098299999";
  const dupEntries = () => [
    {
      event: "paid",
      actor_role: "system",
      provider_id: "790098209516",
      payload: { amountEur: 100 },
      created_at: "2026-07-01T10:00:00Z",
    },
    {
      event: "duplicate",
      actor_role: "system",
      provider_id: Y,
      payload: { amountEur: 100, orderId: Y, duplicate: true },
      created_at: "2026-07-01T10:05:00Z",
    },
    {
      event: "refund_owed",
      actor_role: "system",
      provider_id: Y,
      payload: { amountEur: 100, orderId: Y, duplicate: true },
      created_at: "2026-07-01T10:05:01Z",
    },
  ];

  beforeEach(() => {
    // A confirmed booking, paid once, with a second payment to return.
    bookingRow = { ...bookingRow, status: "confirmed" };
    entries = dupEntries();
  });

  test("the page lists it as owed, and the booking's own refund is untouched", async () => {
    const view = await actions.fetchBookingRefund("token", "b-1");
    expect(view?.duplicates).toEqual([
      { orderId: Y, amountEur: 100, owedEur: 100 },
    ]);
    expect(view?.state).toEqual({ kind: "none" });
    expect(view?.canMark).toBe(false);
  });

  test("marking it records the refund on its own order and never touches the booking", async () => {
    const res = await mark({ duplicateOrderId: Y, note: "devuelto" });
    expect(res).toEqual({ error: null });
    expect(writes).toEqual([]);
    expect(recorded[0]).toMatchObject({
      event: "refunded",
      providerId: Y,
      payload: { amountEur: 100, orderId: Y, duplicate: true },
    });
    expect(String(recorded[0]!.summary)).toContain("pago duplicado");
  });

  test("once returned it is not owed any more, and cannot be marked twice", async () => {
    entries = [
      ...dupEntries(),
      {
        event: "refunded",
        actor_role: "admin",
        provider_id: Y,
        payload: { amountEur: 100, orderId: Y, duplicate: true },
        created_at: "2026-07-02T10:00:00Z",
      },
    ];
    const view = await actions.fetchBookingRefund("token", "b-1");
    expect(view?.duplicates).toEqual([
      { orderId: Y, amountEur: 100, owedEur: 0 },
    ]);
    expect(await mark({ duplicateOrderId: Y })).toEqual({
      error: "nothing_to_refund",
    });
  });

  test("never more than the duplicate, and an order that is not one is refused", async () => {
    expect(await mark({ duplicateOrderId: Y, amountEur: 150 })).toEqual({
      error: "exceeds",
    });
    expect(await mark({ duplicateOrderId: "790098209516" })).toEqual({
      error: "nothing_to_refund",
    });
    expect(await mark({ duplicateOrderId: "x;drop" })).toEqual({
      error: "invalid",
    });
  });

  test("administrators only", async () => {
    actor = { userId: "u-2", role: "staff" };
    expect(await mark({ duplicateOrderId: Y })).toEqual({
      error: "unauthorized",
    });
    expect(
      (await actions.fetchBookingRefund("token", "b-1"))?.canMarkDuplicates,
    ).toBe(false);
  });
});
