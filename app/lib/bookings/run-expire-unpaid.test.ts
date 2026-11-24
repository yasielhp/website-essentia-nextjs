import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import { fakeBookingsDb, type FakeTables, type Row } from "./fake-bookings-db";

/**
 * The expiry of unpaid web bookings, run for real with the database replaced:
 * the half hour runs from the last time the payment was opened, so a client
 * at the bank does not lose her hour, and nothing is released when that
 * history cannot be read.
 *
 * Modules are put back afterwards: `mock.module` is process-wide.
 */

const NOW = new Date("2026-12-01T12:00:00Z");
const minutesAgo = (m: number) =>
  new Date(NOW.getTime() - m * 60_000).toISOString();

let tables: FakeTables;
let eventsFail = false;

const real = {
  admin: { ...(await import("@/lib/insforge-admin")) },
  record: { ...(await import("@/lib/booking-events/record")) },
  propagate: { ...(await import("@/lib/calendar-propagate")) },
};
let expireUnpaidBookings: typeof import("./run-expire-unpaid").expireUnpaidBookings;

beforeAll(async () => {
  mock.module("@/lib/insforge-admin", () => ({
    ...real.admin,
    getAdminClient: () => ({
      database: fakeBookingsDb(tables, {
        fail: (q) => eventsFail && q.table === "booking_events",
      }).db,
    }),
  }));
  mock.module("@/lib/booking-events/record", () => ({
    ...real.record,
    recordBookingEvent: async () => {},
  }));
  mock.module("@/lib/calendar-propagate", () => ({
    ...real.propagate,
    removeBookingFromCalendars: async () => {},
  }));
  ({ expireUnpaidBookings } = await import("./run-expire-unpaid"));
});

afterAll(() => {
  mock.module("@/lib/insforge-admin", () => real.admin);
  mock.module("@/lib/booking-events/record", () => real.record);
  mock.module("@/lib/calendar-propagate", () => real.propagate);
});

const web = (id: string, createdMinutesAgo: number): Row => ({
  id,
  status: "pending",
  payment_status: "pending",
  payment_mode: "full",
  created_by_role: "anonymous",
  created_at: minutesAgo(createdMinutesAgo),
});

beforeEach(() => {
  eventsFail = false;
  tables = {
    bookings: [web("at-the-bank", 40), web("abandoned", 40)],
    service_tiers: [],
    staff_tiers: [],
    contacts: [],
    service_settings: [],
    booking_events: [
      {
        booking_id: "at-the-bank",
        channel: "payment",
        event: "checkout",
        created_at: minutesAgo(10),
      },
      {
        booking_id: "abandoned",
        channel: "payment",
        event: "checkout",
        created_at: minutesAgo(35),
      },
    ],
  };
});

describe("expireUnpaidBookings", () => {
  test("a booking whose payment was opened ten minutes ago keeps its hour; one left at the bank half an hour ago does not", async () => {
    expect(await expireUnpaidBookings(NOW)).toEqual({ expired: ["abandoned"] });
    expect(tables.bookings.map((b) => b.status)).toEqual([
      "pending",
      "cancelled",
    ]);
  });

  test("with no checkout at all, its own age decides", async () => {
    tables.booking_events = [];
    expect((await expireUnpaidBookings(NOW)).expired).toEqual([
      "at-the-bank",
      "abandoned",
    ]);
  });

  test("a history that cannot be read releases nothing this time", async () => {
    eventsFail = true;
    expect(await expireUnpaidBookings(NOW)).toEqual({ expired: [] });
    expect(tables.bookings.every((b) => b.status === "pending")).toBe(true);
  });
});
