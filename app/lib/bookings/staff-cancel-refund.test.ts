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

/**
 * The team's two ways of cancelling, run for real with their edges replaced:
 * the dashboard's save (`updateBookingByAdmin`) and the assistants' tool
 * (`cancelBookingForStaff`). What is pinned is what each hands to
 * `settleRefundOnCancel` (whose own rules are tested apart): only a save that
 * cancels, the session as it stood before the save, and the late refund only
 * from an administrator or staff who asked for it.
 */

type Settle = Parameters<typeof import("./refunds").settleRefundOnCancel>[0];

let settled: Settle[] = [];
type BonusSettle = Parameters<
  typeof import("@/lib/bonuses/settle").settleBonusOnCancel
>[0];
let bonusSettled: BonusSettle[] = [];
let withdrawn: string[] = [];
let rpcCalls = 0;
/** What `readRefundContext` answers before a save that cancels. */
let refundContext: unknown = null;
let actor = { userId: "u-1", role: "admin" };
let before: Record<string, unknown> = {};
let bookingRow: Record<string, unknown> = {};

function chain(table: string): unknown {
  let updating = false;
  const result = () => {
    if (table === "bookings") {
      return updating
        ? { data: [{ id: "b-1" }], error: null }
        : { data: bookingRow, error: null };
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
        return () => {
          updating = true;
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
  refunds: { ...(await import("./refunds")) },
  bonusSettle: { ...(await import("@/lib/bonuses/settle")) },
  propagate: { ...(await import("@/lib/calendar-propagate")) },
  sync: { ...(await import("@/lib/calendar-sync")) },
  wa: { ...(await import("@/lib/whatsapp/notify")) },
  notify: { ...(await import("./notify")) },
};

let updateBookingByAdmin: typeof import("@/actions/booking-draft").updateBookingByAdmin;
let cancelBookingForStaff: typeof import("./for-staff").cancelBookingForStaff;

beforeAll(async () => {
  mock.module("@/lib/insforge-admin", () => ({
    ...real.admin,
    getAdminClient: () => ({
      database: {
        from: (t: string) => chain(t),
        rpc: () => {
          rpcCalls += 1;
          return Promise.resolve({ data: before, error: null });
        },
      },
    }),
  }));
  mock.module("@/lib/auth-guard", () => ({
    ...real.guard,
    requireRole: async () => actor,
  }));
  mock.module("@/lib/booking-events/record", () => ({
    ...real.record,
    recordBookingEvent: async () => {},
    recordBookingEvents: async () => {},
  }));
  mock.module("./refunds", () => ({
    ...real.refunds,
    settleRefundOnCancel: async (input: Settle) => {
      settled.push(input);
      return {
        owed: true,
        amountEur: 100,
        orderId: "790098209516",
        reason: "in_advance",
        hoursBefore: 48,
      };
    },
    readRefundContext: async () => refundContext,
    withdrawRefundOnReactivation: async (input: { bookingId: string }) => {
      withdrawn.push(input.bookingId);
    },
  }));
  mock.module("@/lib/bonuses/settle", () => ({
    ...real.bonusSettle,
    settleBonusOnCancel: async (input: BonusSettle) => {
      bonusSettled.push(input);
      return { bonus: true, returned: false, reason: "late" };
    },
  }));
  mock.module("@/lib/calendar-propagate", () => ({
    ...real.propagate,
    removeBookingFromCalendars: async () => {},
  }));
  mock.module("@/lib/calendar-sync", () => ({
    ...real.sync,
    pushBookingToCalendars: async () => {},
  }));
  mock.module("@/lib/whatsapp/notify", () => ({
    ...real.wa,
    notifyStaffOnWhatsApp: async () => {},
  }));
  mock.module("./notify", () => ({
    ...real.notify,
    notifyBookingCore: async () => ({ email: "sent" }),
  }));
  ({ updateBookingByAdmin } = await import("@/actions/booking-draft"));
  ({ cancelBookingForStaff } = await import("./for-staff"));
});

afterAll(() => {
  mock.module("@/lib/insforge-admin", () => real.admin);
  mock.module("@/lib/auth-guard", () => real.guard);
  mock.module("@/lib/booking-events/record", () => real.record);
  mock.module("./refunds", () => real.refunds);
  mock.module("@/lib/bonuses/settle", () => real.bonusSettle);
  mock.module("@/lib/calendar-propagate", () => real.propagate);
  mock.module("@/lib/calendar-sync", () => real.sync);
  mock.module("@/lib/whatsapp/notify", () => real.wa);
  mock.module("./notify", () => real.notify);
});

beforeEach(() => {
  settled = [];
  bonusSettled = [];
  withdrawn = [];
  rpcCalls = 0;
  refundContext = null;
  actor = { userId: "u-1", role: "admin" };
  before = {
    status: "confirmed",
    date: "2026-07-15",
    time: "10:00",
    service_id: "svc",
    service_title: "Manual Therapies",
    first_name: "Ana",
    last_name: "García",
    email: "ana@example.test",
  };
  bookingRow = {
    id: "b-1",
    status: "confirmed",
    service_id: "svc",
    service_title: "Manual Therapies",
    date: "2026-07-15",
    time: "10:00",
    duration: "60 min",
    first_name: "Ana",
    last_name: "García",
    email: null,
    phone: null,
    staff_id: null,
    amount_paid_eur: "100.00",
    contact_id: null,
    service_tiers: { label: "Drenaje" },
  };
});

/** A save of the edit screen, with the fields that matter here. */
const save = (
  patch: Record<string, unknown>,
  options?: Parameters<typeof updateBookingByAdmin>[3],
) =>
  updateBookingByAdmin(
    "token",
    "b-1",
    {
      ...before,
      status: "confirmed",
      ...patch,
    } as unknown as Parameters<typeof updateBookingByAdmin>[2],
    options,
  );

describe("the dashboard's save", () => {
  test("a save that cancels settles the refund on the session as it was", async () => {
    // Moved and cancelled in one save: judged on the hour it had.
    await save({ status: "cancelled", date: "2026-08-01", time: "12:00" });
    expect(settled).toHaveLength(1);
    expect(settled[0]).toMatchObject({
      bookingId: "b-1",
      source: "dashboard",
      actorId: "u-1",
      actorRole: "admin",
      date: "2026-07-15",
      time: "10:00",
      teamRefundsLate: false,
    });
  });

  test("the late refund is passed on only when asked for", async () => {
    await save({ status: "cancelled" }, { refundLate: true });
    expect(settled[0]?.teamRefundsLate).toBe(true);
  });

  test("staff may ask for it; a partner's request is not heard", async () => {
    actor = { userId: "u-2", role: "staff" };
    await save({ status: "cancelled" }, { refundLate: true });
    expect(settled[0]?.teamRefundsLate).toBe(true);

    actor = { userId: "u-3", role: "partner" };
    await save({ status: "cancelled" }, { refundLate: true });
    expect(settled[1]?.teamRefundsLate).toBe(false);
  });

  test("anything but true is no", async () => {
    await save({ status: "cancelled" }, {
      refundLate: "yes",
    } as unknown as { refundLate: boolean });
    expect(settled[0]?.teamRefundsLate).toBe(false);
  });

  test("a save that does not cancel, or re-saves a cancelled booking, settles nothing", async () => {
    await save({ notes: "x" });
    before = { ...before, status: "cancelled" };
    await save({ status: "cancelled" });
    expect(settled).toEqual([]);
  });
});

describe("a save that cancels and also undoes the online payment", () => {
  const paidOnline = () => {
    refundContext = {
      booking: {
        id: "b-1",
        status: "confirmed",
        payment_status: "paid",
        payment_mode: "full",
        amount_paid_eur: "100.00",
        stripe_session_id: "790098209516",
        balance_settled_method: null,
      },
      entries: [
        {
          event: "paid",
          actor_role: "system",
          provider_id: "790098209516",
          payload: { amountEur: 100 },
          created_at: "2026-07-01T10:00:00Z",
        },
      ],
    };
  };

  test("is refused before anything is written, with a code the screen translates", async () => {
    paidOnline();
    const res = await save({
      status: "cancelled",
      payment_status: "pending",
      amount_paid_eur: 0,
    });
    expect(res).toEqual({ error: "refund_payment_conflict" });
    expect(rpcCalls).toBe(0);
    expect(settled).toEqual([]);
  });

  test("cancelling with the payment left as it is goes through and settles the refund", async () => {
    paidOnline();
    const res = await save({ status: "cancelled" });
    expect(res).toEqual({ error: null });
    expect(rpcCalls).toBe(1);
    expect(settled).toHaveLength(1);
  });

  test("a booking with no online payment may be cancelled and set to unpaid", async () => {
    refundContext = {
      booking: {
        id: "b-1",
        status: "confirmed",
        payment_status: "paid",
        payment_mode: "none",
        amount_paid_eur: "100.00",
        stripe_session_id: null,
        balance_settled_method: "cash",
      },
      entries: [],
    };
    const res = await save({
      status: "cancelled",
      payment_status: "pending",
      amount_paid_eur: 0,
    });
    expect(res).toEqual({ error: null });
  });
});

describe("a bonus session cancelled by the team", () => {
  test("the dashboard's save settles it on the session as it was, lost unless ticked", async () => {
    await save({ status: "cancelled" });
    expect(bonusSettled[0]).toMatchObject({
      bookingId: "b-1",
      source: "dashboard",
      actorRole: "admin",
      date: "2026-07-15",
      time: "10:00",
      teamReturnsLate: false,
    });
  });

  test("ticked by an administrator or staff it is given back; a partner's tick is not heard", async () => {
    await save({ status: "cancelled" }, { bonusReturnLate: true });
    expect(bonusSettled[0]?.teamReturnsLate).toBe(true);
    actor = { userId: "u-3", role: "partner" };
    await save({ status: "cancelled" }, { bonusReturnLate: true });
    expect(bonusSettled[1]?.teamReturnsLate).toBe(false);
  });

  test("a save that does not cancel settles no bonus session", async () => {
    await save({ notes: "x" });
    expect(bonusSettled).toEqual([]);
  });

  test("the assistants' tool settles it too, and answers with it", async () => {
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    const res = await cancelBookingForStaff(
      "b-1",
      undefined,
      { userId: "u-1", role: "staff" },
      { bonusReturnLate: true },
    );
    quiet.mockRestore();
    expect(bonusSettled[0]).toMatchObject({
      source: "assistant",
      teamReturnsLate: true,
    });
    if (res.ok) expect(res.bonus).toMatchObject({ bonus: true });
  });
});

describe("a save that brings a cancelled booking back", () => {
  test("withdraws a pending refund and settles nothing", async () => {
    before = { ...before, status: "cancelled" };
    await save({ status: "confirmed" });
    expect(withdrawn).toEqual(["b-1"]);
    expect(settled).toEqual([]);
  });

  test("a save that keeps it cancelled withdraws nothing", async () => {
    before = { ...before, status: "cancelled" };
    await save({ status: "cancelled", notes: "x" });
    expect(withdrawn).toEqual([]);
  });
});

describe("the assistants' tool", () => {
  test("cancels and settles the refund, and answers with it", async () => {
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    const res = await cancelBookingForStaff("b-1", "client asked", {
      userId: "u-1",
      role: "staff",
    });
    quiet.mockRestore();
    expect(res.ok).toBe(true);
    expect(settled[0]).toMatchObject({
      bookingId: "b-1",
      source: "assistant",
      actorRole: "staff",
      date: "2026-07-15",
      time: "10:00",
      teamRefundsLate: false,
    });
    if (res.ok) {
      expect(res.refund).toMatchObject({ owed: true, amountEur: 100 });
    }
  });

  test("passes the late refund only when asked for", async () => {
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    await cancelBookingForStaff(
      "b-1",
      undefined,
      { userId: "u-1", role: "admin" },
      { refundLate: true },
    );
    quiet.mockRestore();
    expect(settled[0]?.teamRefundsLate).toBe(true);
  });

  test("a booking already cancelled settles nothing", async () => {
    bookingRow = { ...bookingRow, status: "cancelled" };
    const res = await cancelBookingForStaff("b-1", undefined, {
      userId: "u-1",
      role: "admin",
    });
    expect(res).toEqual({ ok: false, error: "already_cancelled" });
    expect(settled).toEqual([]);
  });
});
