import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  setSystemTime,
  test,
} from "bun:test";

/**
 * The real cancellation by link, with the database, the mailer, the history,
 * the calendars and the staff WhatsApp replaced. The clock is set by hand: the
 * 24-hour limit is read in the Canaries' own time, and the server runs in UTC.
 *
 * The modules are put back afterwards: `mock.module` is process-wide.
 */

type Ctx = { table: string; ops: string[] };

let bookingRow: Record<string, unknown> = {};
let bookingUpdates = 0;
let sent: { to: string; subject: string }[] = [];

function resolveDb({ table, ops }: Ctx): unknown {
  if (table === "bookings") {
    if (ops.includes("update")) {
      bookingUpdates += 1;
      return { data: [{ id: "b-1" }], error: null };
    }
    return ops.includes("maybeSingle") || ops.includes("single")
      ? { data: bookingRow, error: null }
      : { data: [bookingRow], error: null };
  }
  return { data: null, error: null };
}

function chain(ctx: Ctx): unknown {
  const proxy: unknown = new Proxy(() => {}, {
    get(_t, prop) {
      if (prop === "then") {
        return (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) =>
          Promise.resolve(resolveDb(ctx)).then(ok, bad);
      }
      return () => {
        ctx.ops.push(String(prop));
        return proxy;
      };
    },
    apply: () => proxy,
  });
  return proxy;
}

const fakeAdmin = {
  getAdminClient: () => ({
    database: { from: (table: string) => chain({ table, ops: [] }) },
  }),
};

const real = {
  admin: { ...(await import("@/lib/insforge-admin")) },
  send: { ...(await import("@/emails/send")) },
  record: { ...(await import("@/lib/booking-events/record")) },
  propagate: { ...(await import("@/lib/calendar-propagate")) },
  wa: { ...(await import("@/lib/whatsapp/notify")) },
};

let actions: typeof import("./booking-cancellation");
const ORIGINAL_TZ = process.env.TZ;

beforeAll(async () => {
  // The production server's clock: the bug was reading the booking's hour in it.
  process.env.TZ = "UTC";
  mock.module("@/lib/insforge-admin", () => fakeAdmin);
  mock.module("@/emails/send", () => ({
    ...real.send,
    sendEmail: async (m: { to: string; subject: string }) => {
      sent.push(m);
      return { error: null, id: "re-1" };
    },
  }));
  mock.module("@/lib/booking-events/record", () => ({
    ...real.record,
    recordBookingEvent: async () => {},
    recordBookingEvents: async () => {},
  }));
  mock.module("@/lib/calendar-propagate", () => ({
    ...real.propagate,
    removeBookingFromCalendars: async () => {},
  }));
  mock.module("@/lib/whatsapp/notify", () => ({
    ...real.wa,
    notifyStaffOnWhatsApp: async () => {},
  }));
  actions = await import("./booking-cancellation");
});

afterAll(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
  mock.module("@/lib/insforge-admin", () => real.admin);
  mock.module("@/emails/send", () => real.send);
  mock.module("@/lib/booking-events/record", () => real.record);
  mock.module("@/lib/calendar-propagate", () => real.propagate);
  mock.module("@/lib/whatsapp/notify", () => real.wa);
});

beforeEach(() => {
  bookingUpdates = 0;
  sent = [];
  bookingRow = {
    id: "b-1",
    service_id: "svc-1",
    service_title: "Drenaje linfático",
    // As the database returns a `date` column.
    date: "2026-07-15T00:00:00.000Z",
    time: "10:00",
    duration: "60 min",
    status: "confirmed",
    first_name: "Ana",
    last_name: "García",
    email: "ana@example.test",
    staff_id: null,
    service_tiers: { label: "Sesión individual" },
  };
});

afterEach(() => {
  setSystemTime();
});

describe("the 24-hour limit of the cancellation link, in summer", () => {
  // 10:00 in the Canaries on 15 July is 09:00 UTC.

  test("23 hours before (10:00 UTC the day before) it is too late", async () => {
    setSystemTime(new Date("2026-07-14T10:00:00Z"));
    const page = await actions.fetchCancellableBooking("tok");
    expect(page?.cancellable).toBe(false);
    const res = await actions.cancelBookingByToken("tok", "es");
    expect(res).toEqual({ ok: false, reason: "too_late" });
    expect(bookingUpdates).toBe(0);
    expect(sent).toHaveLength(0);
  });

  test("exactly 24 hours before it still cancels", async () => {
    setSystemTime(new Date("2026-07-14T09:00:00Z"));
    const page = await actions.fetchCancellableBooking("tok");
    expect(page?.cancellable).toBe(true);
    const res = await actions.cancelBookingByToken("tok", "es");
    expect(res.ok).toBe(true);
    expect(bookingUpdates).toBe(1);
  });
});

describe("the 24-hour limit of the cancellation link, in winter", () => {
  test("is the same hour by the wall clock, a day before", async () => {
    bookingRow = { ...bookingRow, date: "2026-01-15" };
    setSystemTime(new Date("2026-01-14T10:00:00Z"));
    expect((await actions.fetchCancellableBooking("tok"))?.cancellable).toBe(
      true,
    );
    setSystemTime(new Date("2026-01-14T10:01:00Z"));
    expect((await actions.fetchCancellableBooking("tok"))?.cancellable).toBe(
      false,
    );
  });
});
