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
import { refundView } from "@/lib/bookings/refund-rules";
import type { PaymentEntry } from "@/lib/bookings/refund-rules";
import { bookingMoney, ledgerTotals } from "@/lib/payments/ledger";

/**
 * The real `handleBookingPaid` (and the real duplicate recording), with the
 * database a small in-memory booking and history, and the mailer, the
 * calendars and the notices replaced. Two tabs both paying, Redsys repeating
 * its notification, and a duplicate that arrives after a refund.
 */

const X = "790098209516"; // the first tab's order
const Y = "790098299999"; // the second tab's order
const EUR130 = formatPrice(130, "es");

type Booking = Record<string, unknown>;
let booking: Booking = {};
let history: (PaymentEntry & { channel: string })[] = [];
let updates: Record<string, unknown>[] = [];
let sent: { to: string; subject: string; html: string }[] = [];

/**
 * When set, the first `count` reads of the booking each take a snapshot and
 * wait until all of them have read: two webhooks that both pass the read
 * before either writes.
 */
let barrier: {
  count: number;
  reads: number;
  open: () => void;
  opened: Promise<void>;
} | null = null;
function holdReads(count: number) {
  let open = () => {};
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  barrier = { count, reads: 0, open, opened };
}

function chain(table: string): unknown {
  let patch: Record<string, unknown> | null = null;
  const filters: [string, unknown][] = [];
  const within: [string, unknown[]][] = [];
  const result = (): unknown => {
    if (table === "bookings") {
      if (patch) {
        const matches =
          filters.every(([col, v]) => {
            if (col === "id") return true;
            return Number(booking[col] ?? 0) === Number(v);
          }) && within.every(([col, list]) => list.includes(booking[col]));
        if (!matches) return { data: [], error: null };
        updates.push(patch);
        Object.assign(booking, patch);
        return { data: [{ id: "b-1" }], error: null };
      }
      if (barrier && barrier.reads < barrier.count) {
        const snapshot = { ...booking };
        const gate = barrier;
        gate.reads += 1;
        if (gate.reads === gate.count) gate.open();
        return gate.opened.then(() => ({ data: snapshot, error: null }));
      }
      return { data: { ...booking }, error: null };
    }
    if (table === "booking_events") {
      return {
        data: history.filter((e) => e.channel === "payment"),
        error: null,
      };
    }
    if (table === "profiles") {
      return { data: { email: "office@example.test" }, error: null };
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
        return (p: Record<string, unknown>) => {
          patch = p;
          return proxy;
        };
      }
      if (prop === "eq") {
        return (col: string, v: unknown) => {
          filters.push([col, v]);
          return proxy;
        };
      }
      if (prop === "in") {
        return (col: string, list: unknown[]) => {
          within.push([col, list]);
          return proxy;
        };
      }
      return () => proxy;
    },
    apply: () => proxy,
  });
  return proxy;
}

let clock = 0;
const real = {
  admin: { ...(await import("@/lib/insforge-admin")) },
  send: { ...(await import("@/emails/send")) },
  record: { ...(await import("@/lib/booking-events/record")) },
  consent: { ...(await import("@/lib/consent/server")) },
  calendar: { ...(await import("@/lib/calendar-sync")) },
  wa: { ...(await import("@/lib/whatsapp/notify")) },
  waClient: { ...(await import("@/lib/whatsapp/notify-client")) },
  staffPaid: { ...(await import("@/lib/bookings/notify-staff-paid")) },
};
let handleBookingPaid: typeof import("./booking-payments.service").handleBookingPaid;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_APP_URL ??= "https://app.example.test";
  mock.module("@/lib/insforge-admin", () => ({
    ...real.admin,
    getAdminClient: () => ({ database: { from: (t: string) => chain(t) } }),
  }));
  mock.module("@/emails/send", () => ({
    ...real.send,
    sendEmail: async (m: (typeof sent)[number]) => {
      sent.push(m);
      return { error: null, id: "re-1" };
    },
  }));
  mock.module("@/lib/booking-events/record", () => ({
    ...real.record,
    recordBookingEvent: async (e: {
      channel: string;
      event: string;
      actorRole?: string | null;
      providerId?: string | null;
      payload?: Record<string, unknown> | null;
      status?: string;
      summary: string;
    }) => {
      history.push({
        channel: e.channel,
        event: e.event,
        actor_role: e.actorRole ?? null,
        provider_id: e.providerId ?? null,
        payload: e.payload ?? null,
        status: e.status ?? "done",
        created_at: new Date(Date.UTC(2026, 10, 24, 0, clock++)).toISOString(),
        summary: e.summary,
      } as PaymentEntry & { channel: string; summary: string });
    },
  }));
  mock.module("@/lib/consent/server", () => ({
    ...real.consent,
    pendingConsentUrl: async () => null,
  }));
  mock.module("@/lib/calendar-sync", () => ({
    ...real.calendar,
    pushBookingToCalendars: async () => {},
  }));
  mock.module("@/lib/whatsapp/notify", () => ({
    ...real.wa,
    notifyStaffOnWhatsApp: async () => {},
  }));
  mock.module("@/lib/whatsapp/notify-client", () => ({
    ...real.waClient,
    notifyClientOnWhatsApp: async () => {},
  }));
  mock.module("@/lib/bookings/notify-staff-paid", () => ({
    ...real.staffPaid,
    notifyStaffOfPaidBooking: async () => {},
  }));
  ({ handleBookingPaid } = await import("./booking-payments.service"));
});

afterAll(() => {
  mock.module("@/lib/insforge-admin", () => real.admin);
  mock.module("@/emails/send", () => real.send);
  mock.module("@/lib/booking-events/record", () => real.record);
  mock.module("@/lib/consent/server", () => real.consent);
  mock.module("@/lib/calendar-sync", () => real.calendar);
  mock.module("@/lib/whatsapp/notify", () => real.wa);
  mock.module("@/lib/whatsapp/notify-client", () => real.waClient);
  mock.module("@/lib/bookings/notify-staff-paid", () => real.staffPaid);
});

beforeEach(() => {
  booking = {
    id: "b-1",
    first_name: "Ana",
    last_name: "García",
    email: "ana@example.test",
    service_title: "Manual Therapies",
    date: "2026-12-15",
    time: "10:00",
    duration: "60 min",
    price_eur: 130,
    amount_paid_eur: 0,
    payment_status: "pending",
    payment_mode: "full",
    status: "pending",
    // The second tab's order: the newest checkout overwrote the first.
    stripe_session_id: Y,
    balance_settled_method: null,
    contact_id: null,
    staff_id: null,
  };
  history = [];
  updates = [];
  sent = [];
  barrier = null;
});

const payments = (event: string) =>
  history.filter((e) => e.channel === "payment" && e.event === event);
const office = () => sent.filter((m) => m.to === "office@example.test");

describe("two tabs, both paid", () => {
  test("the first payment counts, the second is a duplicate owed back on its own order", async () => {
    await handleBookingPaid("b-1", 13000, X);
    expect(booking).toMatchObject({
      payment_status: "paid",
      amount_paid_eur: 130,
    });
    expect(payments("paid")).toHaveLength(1);
    expect(payments("paid")[0]!.provider_id).toBe(X);

    const quiet = spyOn(console, "error").mockImplementation(() => {});
    await handleBookingPaid("b-1", 13000, Y);
    quiet.mockRestore();

    // Paid once: the second payment never touched the booking.
    expect(updates).toHaveLength(1);
    expect(booking).toMatchObject({
      payment_status: "paid",
      amount_paid_eur: 130,
    });
    const duplicate = payments("duplicate");
    expect(duplicate).toHaveLength(1);
    expect(duplicate[0]).toMatchObject({
      provider_id: Y,
      payload: { orderId: Y, firstOrderId: X, amountEur: 130, duplicate: true },
    });
    const owed = payments("refund_owed");
    expect(owed).toHaveLength(1);
    expect(owed[0]).toMatchObject({
      provider_id: Y,
      payload: { amountEur: 130, orderId: Y, duplicate: true },
    });

    // The office is told, naming the duplicate order and the first one.
    expect(office()).toHaveLength(1);
    expect(office()[0]!.subject).toBe(
      `Reembolso pendiente (pago duplicado) — ${EUR130} · Ana García`,
    );
    expect(office()[0]!.html).toContain(Y);
    expect(office()[0]!.html).toContain(`con el pedido ${X}`);

    // The ledger counts the booking once; the page shows the duplicate owed.
    expect(
      ledgerTotals([
        bookingMoney(booking as Parameters<typeof bookingMoney>[0]),
      ]).revenue,
    ).toBe(130);
    const view = refundView(
      booking as Parameters<typeof refundView>[0],
      history,
      true,
    );
    expect(view.duplicates).toEqual([
      { orderId: Y, amountEur: 130, owedEur: 130 },
    ]);
    expect(view.state).toEqual({ kind: "none" });
    expect(view.onlineEur).toBe(130);
  });

  test("Redsys repeating either notification changes nothing more", async () => {
    await handleBookingPaid("b-1", 13000, X);
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    await handleBookingPaid("b-1", 13000, Y);
    quiet.mockRestore();
    const before = { history: history.length, sent: sent.length };

    await handleBookingPaid("b-1", 13000, X);
    await handleBookingPaid("b-1", 13000, Y);

    expect(history).toHaveLength(before.history);
    expect(sent).toHaveLength(before.sent);
    expect(updates).toHaveLength(1);
  });
});

describe("a duplicate that arrives after a refund", () => {
  test("is owed back on its own order; the booking stays refunded", async () => {
    booking = {
      ...booking,
      status: "cancelled",
      payment_status: "refunded",
      amount_paid_eur: 130,
    };
    history = [
      {
        channel: "payment",
        event: "paid",
        actor_role: "system",
        provider_id: X,
        payload: { amountEur: 130 },
        created_at: "2026-11-01T10:00:00Z",
      },
      {
        channel: "payment",
        event: "refunded",
        actor_role: "admin",
        provider_id: X,
        payload: { amountEur: 130 },
        created_at: "2026-11-03T10:00:00Z",
      },
    ];
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    await handleBookingPaid("b-1", 13000, Y);
    quiet.mockRestore();

    expect(updates).toEqual([]);
    expect(booking.payment_status).toBe("refunded");
    expect(payments("duplicate")[0]).toMatchObject({
      provider_id: Y,
      payload: { firstOrderId: X },
    });
    const view = refundView(
      booking as Parameters<typeof refundView>[0],
      history,
      true,
    );
    expect(view.state).toEqual({ kind: "refunded", amountEur: 130 });
    expect(view.duplicates).toEqual([
      { orderId: Y, amountEur: 130, owedEur: 130 },
    ]);
    expect(office()).toHaveLength(1);
  });
});

describe("the first payment, as before", () => {
  test("a single notification pays the booking and is not a duplicate", async () => {
    await handleBookingPaid("b-1", 13000, Y);
    expect(booking).toMatchObject({
      payment_status: "paid",
      status: "confirmed",
    });
    expect(payments("duplicate")).toEqual([]);
    expect(office()).toEqual([]);
  });

  test("without an order passed, the booking's own order is used", async () => {
    await handleBookingPaid("b-1", 13000);
    expect(payments("paid")[0]!.provider_id).toBe(Y);
  });
});

describe("two orders authorised at the same moment", () => {
  test("both pass the read before either writes: one pays, the other is a duplicate, never only a log", async () => {
    holdReads(2);
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    await Promise.all([
      handleBookingPaid("b-1", 13000, X),
      handleBookingPaid("b-1", 13000, Y),
    ]);
    quiet.mockRestore();

    // The booking was written once, by the winner, with its order.
    expect(updates).toHaveLength(1);
    const winner = booking.stripe_session_id as string;
    const loser = winner === X ? Y : X;
    expect(booking).toMatchObject({
      payment_status: "paid",
      amount_paid_eur: 130,
    });
    expect(payments("paid")).toHaveLength(1);
    expect(payments("paid")[0]!.provider_id).toBe(winner);

    // The loser: recorded, owed back on its own order, the office told.
    expect(payments("duplicate")).toHaveLength(1);
    expect(payments("duplicate")[0]).toMatchObject({
      provider_id: loser,
      payload: { orderId: loser, firstOrderId: winner, duplicate: true },
    });
    expect(payments("refund_owed")[0]).toMatchObject({
      provider_id: loser,
      payload: { amountEur: 130, duplicate: true },
    });
    expect(office()).toHaveLength(1);
    expect(office()[0]!.html).toContain(loser);
    expect(office()[0]!.html).toContain(`con el pedido ${winner}`);
  });

  test("the SAME order twice at once is a retry: paid once, nothing owed, nobody told", async () => {
    holdReads(2);
    await Promise.all([
      handleBookingPaid("b-1", 13000, X),
      handleBookingPaid("b-1", 13000, X),
    ]);
    expect(updates).toHaveLength(1);
    expect(payments("paid")).toHaveLength(1);
    expect(payments("duplicate")).toEqual([]);
    expect(payments("refund_owed")).toEqual([]);
    expect(office()).toEqual([]);
  });
});
