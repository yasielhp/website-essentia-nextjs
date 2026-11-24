import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import {
  clashes,
  fakeBookingsDb,
  OVERLAP_ERROR,
  type FakeTables,
  type Row,
} from "@/lib/bookings/fake-bookings-db";
import type { UpdateBookingPayload } from "@/types/booking";

/**
 * The dashboard's other writes of a booking, run for real with the session
 * check, the database (an in-memory copy that keeps `bookings_no_overlap`),
 * the history and the calendars replaced.
 *
 * With the browser's key a partner could only touch her own bookings (the
 * database's `partner_id = auth.uid()`); these actions use the service key,
 * so they must keep that rule themselves: a partner edits and takes money
 * only on hers, and deletes none (her screen offers no delete). And the edit
 * says in words when the professional already has a booking at that hour.
 *
 * Modules are put back afterwards: `mock.module` is process-wide.
 */

const STAFF = "33333333-3333-4333-8333-333333333333";
const ME = "77777777-7777-4777-8777-777777777777";
const SOMEONE = "44444444-4444-4444-8444-444444444444";

let role = "partner";
let tables: FakeTables;
let calendarsCleared: string[] = [];

const real = {
  admin: { ...(await import("@/lib/insforge-admin")) },
  guard: { ...(await import("@/lib/auth-guard")) },
  record: { ...(await import("@/lib/booking-events/record")) },
  propagate: { ...(await import("@/lib/calendar-propagate")) },
};

let draftActions: typeof import("@/actions/booking-draft");
let recordCounterPayment: typeof import("@/actions/booking-payment").recordCounterPayment;

/** `update_booking_returning_previous`, as the database runs it: one row, the old one back. */
function editFunction(args: { p_id: string; p_payload: Row }) {
  const row = tables.bookings.find((r) => r.id === args.p_id);
  if (!row) return { data: null, error: null };
  const before = { ...row };
  const after = { ...row, ...args.p_payload };
  if (clashes(after, tables.bookings)) {
    return { data: null, error: OVERLAP_ERROR };
  }
  Object.assign(row, after);
  return { data: before, error: null };
}

beforeAll(async () => {
  mock.module("@/lib/insforge-admin", () => ({
    ...real.admin,
    getAdminClient: () => ({
      database: {
        from: fakeBookingsDb(tables).db.from,
        rpc: (name: string, args: { p_id: string; p_payload: Row }) =>
          Promise.resolve(
            name === "update_booking_returning_previous"
              ? editFunction(args)
              : { data: null, error: { message: `unexpected ${name}` } },
          ),
      },
    }),
  }));
  mock.module("@/lib/auth-guard", () => ({
    ...real.guard,
    requireRole: async (
      token: unknown,
      allowed: string[] = ["admin", "staff", "partner"],
    ) => {
      if (!token)
        throw new real.guard.AuthError("Authentication required", 401);
      if (!allowed.includes(role)) {
        throw new real.guard.AuthError(
          "Insufficient permissions for this operation",
          403,
        );
      }
      return { userId: ME, email: null, verifiedEmail: null, role };
    },
  }));
  mock.module("@/lib/booking-events/record", () => ({
    ...real.record,
    recordBookingEvent: async () => {},
    recordBookingEvents: async () => {},
  }));
  mock.module("@/lib/calendar-propagate", () => ({
    ...real.propagate,
    removeBookingFromCalendars: async (id: string) => {
      calendarsCleared.push(id);
    },
  }));
  draftActions = await import("@/actions/booking-draft");
  ({ recordCounterPayment } = await import("@/actions/booking-payment"));
});

afterAll(() => {
  mock.module("@/lib/insforge-admin", () => real.admin);
  mock.module("@/lib/auth-guard", () => real.guard);
  mock.module("@/lib/booking-events/record", () => real.record);
  mock.module("@/lib/calendar-propagate", () => real.propagate);
});

const booking = (over: Row = {}): Row => ({
  id: "mine",
  status: "confirmed",
  partner_id: ME,
  staff_id: STAFF,
  service_id: "manual-therapies",
  service_title: "Manual Therapies",
  date: "2099-08-20",
  time: "10:00",
  duration: "50 min",
  price_eur: 90,
  amount_paid_eur: 0,
  payment_status: "pending",
  payment_mode: "none",
  first_name: "Ana",
  last_name: "García",
  email: "ana@example.com",
  ...over,
});

beforeEach(() => {
  role = "partner";
  calendarsCleared = [];
  tables = {
    bookings: [
      booking(),
      booking({ id: "theirs", partner_id: SOMEONE, time: "16:00" }),
    ],
    service_tiers: [],
    staff_tiers: [],
    contacts: [],
    service_settings: [],
  };
});

const edit = (id: string, over: Partial<UpdateBookingPayload> = {}) =>
  draftActions.updateBookingByAdmin("token", id, {
    service_id: "manual-therapies",
    service_title: "Manual Therapies",
    tier_id: null,
    duration: "50 min",
    date: "2099-08-20",
    time: "11:00",
    location: "centro",
    location_address: null,
    notes: null,
    first_name: "Ana",
    last_name: "García",
    email: "ana@example.com",
    phone: null,
    status: "confirmed",
    ...over,
  });

const row = (id: string) => tables.bookings.find((r) => r.id === id)!;

describe("a partner, through the service key, reaches only her own bookings", () => {
  test("she edits hers", async () => {
    expect(await edit("mine")).toEqual({ error: null });
    expect(row("mine").time).toBe("11:00");
  });

  test("somebody else's is refused, and left as it was", async () => {
    expect(await edit("theirs")).toEqual({
      error: "Insufficient permissions for this operation",
    });
    expect(row("theirs").time).toBe("16:00");
  });

  test("she deletes none, not even hers", async () => {
    expect(await draftActions.deleteBooking("token", "mine")).toEqual({
      error: "Insufficient permissions for this operation",
    });
    expect(tables.bookings).toHaveLength(2);
    expect(calendarsCleared).toEqual([]);
  });

  test("she takes money on hers, and on nobody else's", async () => {
    expect(
      await recordCounterPayment("token", {
        bookingId: "mine",
        amountEur: 90,
        method: "cash",
      }),
    ).toEqual({ error: null });
    expect(row("mine").amount_paid_eur).toBe(90);
    expect(
      await recordCounterPayment("token", {
        bookingId: "theirs",
        amountEur: 90,
        method: "cash",
      }),
    ).toEqual({ error: "not_found" });
    expect(row("theirs").amount_paid_eur).toBe(0);
  });

  test("staff still reach every booking, and may delete", async () => {
    role = "staff";
    expect(await edit("theirs")).toEqual({ error: null });
    expect(await draftActions.deleteBooking("token", "theirs")).toEqual({
      error: null,
    });
    expect(calendarsCleared).toEqual(["theirs"]);
  });
});

describe("the edit and the professional's hour", () => {
  test("moving a booking onto an hour she already has is 'slot_taken', and nothing moves", async () => {
    role = "admin";
    // "theirs" holds 16:00 for the same professional.
    expect(await edit("mine", { time: "16:30" })).toEqual({
      error: "slot_taken",
    });
    expect(row("mine").time).toBe("10:00");
  });

  test("bringing a cancelled booking back onto a taken hour is refused the same way", async () => {
    role = "admin";
    tables.bookings.push(
      booking({ id: "gone", status: "cancelled", time: "16:20" }),
    );
    expect(await edit("gone", { time: "16:20", status: "confirmed" })).toEqual({
      error: "slot_taken",
    });
    expect(row("gone").status).toBe("cancelled");
  });
});
