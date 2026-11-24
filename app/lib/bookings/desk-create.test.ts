import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import { fakeBookingsDb, type FakeTables } from "./fake-bookings-db";

/**
 * `createDeskBooking`, the dashboard's "New booking", run for real with the
 * session check and the database replaced (an in-memory copy that keeps the
 * rule of `bookings_no_overlap`).
 *
 * It used to insert from the browser. What is under test: WHO may take a
 * booking (the team, from a valid token), WHAT the screen may send (a strict
 * object: a status, a price or a partner sent along refuses it), what the
 * server decides (price by session type and place, duration, the service's
 * name, `confirmed`, who created it, a partner's own bookings), and that an
 * hour the professional already has is answered `slot_taken`.
 *
 * Modules are put back afterwards: `mock.module` is process-wide.
 */

const TIER = "11111111-1111-4111-8111-111111111111";
const OTHER_TIER = "22222222-2222-4222-8222-222222222222";
const STAFF = "33333333-3333-4333-8333-333333333333";
const CONTACT = "55555555-5555-4555-8555-555555555555";
const ME = "77777777-7777-4777-8777-777777777777";

let role: string | null = "staff";
let tables: FakeTables;

const real = {
  admin: { ...(await import("@/lib/insforge-admin")) },
  guard: { ...(await import("@/lib/auth-guard")) },
};

let createDeskBooking: typeof import("@/actions/desk-booking").createDeskBooking;

beforeAll(async () => {
  mock.module("@/lib/insforge-admin", () => ({
    ...real.admin,
    getAdminClient: () => ({ database: fakeBookingsDb(tables).db }),
  }));
  mock.module("@/lib/auth-guard", () => ({
    ...real.guard,
    requireRole: async (
      token: unknown,
      allowed: string[] = ["admin", "staff", "partner"],
    ) => {
      if (!token || !role) {
        throw new real.guard.AuthError("Authentication required", 401);
      }
      if (!allowed.includes(role)) {
        throw new real.guard.AuthError("Insufficient permissions", 403);
      }
      return { userId: ME, email: null, verifiedEmail: null, role };
    },
  }));
  ({ createDeskBooking } = await import("@/actions/desk-booking"));
});

afterAll(() => {
  mock.module("@/lib/insforge-admin", () => real.admin);
  mock.module("@/lib/auth-guard", () => real.guard);
});

beforeEach(() => {
  role = "staff";
  tables = {
    bookings: [],
    service_tiers: [
      {
        id: TIER,
        service_id: "manual-therapies",
        duration_minutes: 50,
        price_eur: 81,
        price_center_eur: "90.00",
        price_suite_eur: 120,
      },
      {
        id: OTHER_TIER,
        service_id: "facial-therapies",
        duration_minutes: 60,
        price_eur: 20,
        price_center_eur: 20,
        price_suite_eur: 20,
      },
    ],
    staff_tiers: [],
    contacts: [],
    service_settings: [{ id: "manual-therapies", title: "Terapias manuales" }],
  };
});

/** Exactly what the desk's screen sends. */
const form = (over: Record<string, unknown> = {}) => ({
  serviceId: "manual-therapies",
  tierId: TIER,
  staffId: STAFF,
  date: "2099-08-20",
  time: "10:00",
  location: "centro",
  locationAddress: '{"roomNumber":"","reservationNumber":"R-1"}',
  notes: "Primera visita",
  firstName: "Ana",
  lastName: "García",
  email: "ana@example.com",
  phone: "600000000",
  contactId: CONTACT,
  payment: { status: "pending", amountPaidEur: 0, method: null },
  ...over,
});

const only = () => {
  expect(tables.bookings).toHaveLength(1);
  return tables.bookings[0]!;
};

describe("who may take a booking at the desk", () => {
  test("no token, or one that is not the team's, writes nothing", async () => {
    expect(await createDeskBooking(null, form())).toEqual({
      ok: false,
      error: "session",
    });
    role = "client";
    expect(await createDeskBooking("token", form())).toEqual({
      ok: false,
      error: "session",
    });
    expect(tables.bookings).toEqual([]);
  });

  test("staff write it with the service key, priced and named by the server", async () => {
    const answer = await createDeskBooking("token", form());
    expect(answer.ok).toBe(true);
    const row = only();
    expect(row).toMatchObject({
      service_id: "manual-therapies",
      service_title: "Terapias manuales",
      tier_id: TIER,
      // The centre price, as the screen shows it for the centre.
      price_eur: 90,
      duration: "50 min",
      status: "confirmed",
      payment_status: "pending",
      payment_mode: "none",
      amount_paid_eur: 0,
      staff_id: STAFF,
      contact_id: CONTACT,
      created_by_user_id: ME,
      created_by_role: "staff",
    });
    expect(row.partner_id).toBeUndefined();
    expect(row.id).toBe((answer as { bookingId: string }).bookingId);
  });

  test("a hotel room has its own price", async () => {
    await createDeskBooking("token", form({ location: "habitacion" }));
    expect(only().price_eur).toBe(120);
  });

  test("a partner's booking is hers, and a home visit is not hers to offer", async () => {
    role = "partner";
    await createDeskBooking("token", form());
    expect(only()).toMatchObject({
      partner_id: ME,
      created_by_role: "partner",
    });
    expect(
      await createDeskBooking("token", form({ location: "domicilio" })),
    ).toEqual({ ok: false, error: "forbidden" });
    expect(tables.bookings).toHaveLength(1);
  });
});

describe("what the screen may send", () => {
  test.each([
    ["status", "cancelled"],
    ["price_eur", 0.01],
    ["priceEur", 1],
    ["payment_status", "paid"],
    ["partner_id", ME],
    ["partnerId", ME],
    ["created_by_role", "admin"],
    ["role", "admin"],
    ["serviceTitle", "Anything"],
    ["duration", "5 min"],
  ])(
    "a key it does not send (%s) refuses the whole call",
    async (key, value) => {
      expect(await createDeskBooking("token", form({ [key]: value }))).toEqual({
        ok: false,
        error: "invalid",
      });
      expect(tables.bookings).toEqual([]);
    },
  );

  test("a payment with keys of its own is refused too", async () => {
    expect(
      await createDeskBooking(
        "token",
        form({
          payment: {
            status: "paid",
            amountPaidEur: 90,
            method: "cash",
            payment_status: "paid",
          },
        }),
      ),
    ).toEqual({ ok: false, error: "invalid" });
  });

  test.each([
    ["a service there is not", { serviceId: "made-up" }],
    ["a session type of another service", { tierId: OTHER_TIER }],
    ["a day that is not one", { date: "2099-02-31" }],
    ["an hour that is not one", { time: "9am" }],
    [
      "a negative amount",
      { payment: { status: "paid", amountPaidEur: -5, method: "cash" } },
    ],
  ])("%s is refused", async (_label, over) => {
    expect(await createDeskBooking("token", form(over))).toEqual({
      ok: false,
      error: "invalid",
    });
  });

  test("money taken at the counter: paid in full, settled with its method", async () => {
    await createDeskBooking(
      "token",
      form({ payment: { status: "paid", amountPaidEur: 90, method: "card" } }),
    );
    expect(only()).toMatchObject({
      payment_status: "paid",
      payment_mode: "full",
      amount_paid_eur: 90,
      balance_settled_method: "card",
    });
    expect(typeof only().balance_settled_at).toBe("string");
  });

  test("'paid' with nothing taken is pending, with nothing settled", async () => {
    await createDeskBooking(
      "token",
      form({ payment: { status: "paid", amountPaidEur: 0, method: "cash" } }),
    );
    expect(only()).toMatchObject({
      payment_status: "pending",
      payment_mode: "none",
      amount_paid_eur: 0,
    });
    expect(only().balance_settled_at).toBeUndefined();
  });
});

describe("the professional's hour", () => {
  test("an hour she already has is 'slot_taken', and nothing is written", async () => {
    tables.bookings.push({
      id: "held",
      status: "pending",
      staff_id: STAFF,
      date: "2099-08-20",
      time: "10:30",
      duration: "50 min",
    });
    expect(await createDeskBooking("token", form())).toEqual({
      ok: false,
      error: "slot_taken",
    });
    expect(tables.bookings).toHaveLength(1);
  });

  test("the hour of a cancelled booking, or of a form still in progress, is free", async () => {
    tables.bookings.push(
      {
        id: "a",
        status: "cancelled",
        staff_id: STAFF,
        date: "2099-08-20",
        time: "10:00",
        duration: "50 min",
      },
      {
        id: "b",
        status: "draft",
        staff_id: STAFF,
        date: "2099-08-20",
        time: "10:00",
        duration: "50 min",
      },
    );
    expect((await createDeskBooking("token", form())).ok).toBe(true);
  });
});
