import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import { withClaim } from "./draft-claim";
import {
  fakeBookingsDb,
  fakeId,
  type Failure,
  type FakeTables,
  type Row,
} from "./fake-bookings-db";

/**
 * The public booking form's writes, run for real through their server
 * actions (`app/actions/public-booking.ts`), with the database, the session
 * check and the booking history replaced. The database is an in-memory copy
 * that keeps the rule of `bookings_no_overlap`.
 *
 * What is under test: the visitor sends only what she chooses, and the server
 * decides the rest (status, price, payment, place, account); a key the form
 * does not send refuses the call; the account is the one her token proves;
 * the draft is reused, not duplicated; the confirmation says whether THIS
 * call made the booking, and why not; and an hour another booking of the
 * professional holds is answered `slot_taken`.
 *
 * Modules are put back afterwards: `mock.module` is process-wide.
 */

const TIER = "11111111-1111-4111-8111-111111111111";
const OTHER_TIER = "22222222-2222-4222-8222-222222222222";
const STAFF = "33333333-3333-4333-8333-333333333333";
const STRANGER = "44444444-4444-4444-8444-444444444444";
const CONTACT = "55555555-5555-4555-8555-555555555555";
const OTHERS_CONTACT = "66666666-6666-4666-8666-666666666666";
const CLIENT = "77777777-7777-4777-8777-777777777777";
const DRAFT = "88888888-8888-4888-8888-888888888888";
const STAFF_2 = "99999999-9999-4999-8999-999999999990";

// The claim cookie is signed with a server secret; the tests have no keys.
process.env.BOOKING_CLAIM_SECRET ??= "test-booking-claim-secret";

/** This browser's cookie of claims, as the actions read and set it. */
let jar: string | null = null;
/** The hours each professional has free that day (`fetchAvailability`). */
let freeHours: Record<string, string[]> = {};
let availabilityAsked: { staffId: unknown; excludeDraftId: unknown }[] = [];

let tables: FakeTables;
let failure: Failure | null = null;
let beforeUpdate: (() => void) | null = null;
let events: Record<string, unknown>[] = [];

const real = {
  admin: { ...(await import("@/lib/insforge-admin")) },
  guard: { ...(await import("@/lib/auth-guard")) },
  record: { ...(await import("@/lib/booking-events/record")) },
  visitor: { ...(await import("./visitor")) },
  availability: { ...(await import("@/actions/availability")) },
};

let actions: typeof import("@/actions/public-booking");
let core: typeof import("./public-booking");

beforeAll(async () => {
  mock.module("@/lib/insforge-admin", () => ({
    ...real.admin,
    getAdminClient: () => ({
      database: fakeBookingsDb(tables, {
        // Once: the query named fails, and the next one goes through.
        fail: (query) => {
          if (
            !failure ||
            failure.table !== query.table ||
            failure.kind !== query.kind
          ) {
            return false;
          }
          failure = null;
          return true;
        },
        beforeUpdate: () => beforeUpdate?.(),
      }).db,
    }),
  }));
  mock.module("@/lib/auth-guard", () => ({
    ...real.guard,
    authenticate: async (token: unknown) => {
      if (token === "client-token") {
        return {
          userId: CLIENT,
          email: "ana@example.com",
          verifiedEmail: "ana@example.com",
          role: "client",
        };
      }
      throw new real.guard.AuthError("Invalid or expired session", 401);
    },
  }));
  mock.module("@/lib/booking-events/record", () => ({
    ...real.record,
    recordBookingEvent: async (event: Record<string, unknown>) => {
      events.push(event);
    },
  }));
  mock.module("./visitor", () => ({
    ...real.visitor,
    readVisitor: async () => ({ claims: jar, ip: null }),
    rememberClaim: async (_visitor: unknown, bookingId: string) => {
      jar = withClaim(jar, bookingId);
    },
  }));
  mock.module("@/actions/availability", () => ({
    ...real.availability,
    fetchAvailability: async (input: {
      staffId: string;
      from: string;
      excludeDraftId?: string | null;
    }) => {
      availabilityAsked.push({
        staffId: input.staffId,
        excludeDraftId: input.excludeDraftId,
      });
      return { [input.from]: freeHours[input.staffId] ?? [] };
    },
  }));
  actions = await import("@/actions/public-booking");
  core = await import("./public-booking");
});

afterAll(() => {
  mock.module("@/lib/insforge-admin", () => real.admin);
  mock.module("@/lib/auth-guard", () => real.guard);
  mock.module("@/lib/booking-events/record", () => real.record);
  mock.module("./visitor", () => real.visitor);
  mock.module("@/actions/availability", () => real.availability);
});

beforeEach(() => {
  tables = {
    bookings: [],
    service_tiers: [
      {
        id: TIER,
        service_id: "manual-therapies",
        duration_minutes: 50,
        price_eur: "81.00",
        price_center_eur: 90,
        active: true,
      },
      {
        id: OTHER_TIER,
        service_id: "facial-therapies",
        duration_minutes: 60,
        price_eur: 20,
        price_center_eur: 20,
        active: true,
      },
    ],
    staff_tiers: [
      { tier_id: TIER, staff_id: STAFF },
      { tier_id: TIER, staff_id: STAFF_2 },
    ],
    contacts: [
      { id: CONTACT, email: "ana@example.com" },
      { id: OTHERS_CONTACT, email: "someone@else.com" },
    ],
    service_settings: [
      { id: "manual-therapies", active: true },
      { id: "facial-therapies", active: true },
    ],
  };
  // This browser holds the claim on DRAFT, as if it had started it.
  jar = withClaim(null, DRAFT);
  freeHours = {
    [STAFF]: ["09:40", "10:00", "10:30", "11:20"],
    [STAFF_2]: ["10:30"],
  };
  availabilityAsked = [];
  failure = null;
  beforeUpdate = null;
  events = [];
});

/** Exactly what the details step sends. */
const details = (over: Record<string, unknown> = {}) => ({
  draftId: null,
  contactId: CONTACT,
  serviceId: "manual-therapies",
  tierId: TIER,
  staffId: STAFF,
  firstName: "Ana",
  lastName: "García",
  email: "Ana@Example.com",
  phone: "600000000",
  notes: "Rodilla izquierda",
  ...over,
});

/** Exactly what the last step sends. */
const confirmation = (over: Record<string, unknown> = {}) => ({
  ...details(),
  draftId: DRAFT,
  date: "2099-08-20",
  time: "10:30",
  ...over,
});

const draftRow = (over: Row = {}): Row => ({
  id: DRAFT,
  status: "draft",
  service_title: "Manual Therapies",
  staff_id: STAFF,
  date: null,
  time: null,
  duration: "50 min",
  ...over,
});

const only = () => {
  expect(tables.bookings).toHaveLength(1);
  return tables.bookings[0]!;
};

describe("the details step starts the draft, on the server's terms", () => {
  test("a guest's draft: what she chose, priced and placed by the server, linked to no account", async () => {
    const answer = await actions.savePublicDraft(null, details());
    expect(answer).toEqual({ ok: true, bookingId: fakeId(1) });
    expect(only()).toEqual({
      id: fakeId(1),
      status: "draft",
      service_id: "manual-therapies",
      service_title: "Manual Therapies",
      tier_id: TIER,
      duration: "50 min",
      // The web price of the session type, read on the server.
      price_eur: 81,
      payment_mode: "full",
      location: "centro",
      notes: "Pago: 100% online al reservar\n\nRodilla izquierda",
      first_name: "Ana",
      last_name: "García",
      email: "Ana@Example.com",
      phone: "600000000",
      contact_id: CONTACT,
      staff_id: STAFF,
      created_by_role: "anonymous",
    });
  });

  test("a signed-in client's draft is hers by her VERIFIED session", async () => {
    await actions.savePublicDraft("client-token", details());
    expect(only()).toMatchObject({
      user_id: CLIENT,
      created_by_user_id: CLIENT,
      created_by_role: "client",
    });
  });

  test("a token that does not check out is a guest: no account is written", async () => {
    await actions.savePublicDraft("forged", details());
    const row = only();
    expect(row.user_id).toBeUndefined();
    expect(row.created_by_user_id).toBeUndefined();
    expect(row.created_by_role).toBe("anonymous");
  });

  test.each([
    ["status", "confirmed"],
    ["price_eur", 0.01],
    ["payment_status", "paid"],
    ["amount_paid_eur", 81],
    ["user_id", CLIENT],
    ["userId", CLIENT],
    ["created_by_role", "admin"],
    ["partner_id", STRANGER],
    ["serviceTitle", "Anything"],
    ["duration", "5 min"],
  ])(
    "a key the form does not send (%s) refuses the whole call, and nothing is written",
    async (key, value) => {
      const answer = await actions.savePublicDraft(
        null,
        details({ [key]: value }),
      );
      expect(answer).toEqual({ ok: false, error: "invalid" });
      expect(tables.bookings).toEqual([]);
    },
  );

  test.each([
    ["a service the site does not offer", { serviceId: "made-up" }],
    ["a session type of another service", { tierId: OTHER_TIER }],
    ["a session type that is not there", { tierId: STRANGER }],
    ["a professional who does not perform it", { staffId: STRANGER }],
    ["a professional with no session type", { tierId: null }],
    ["an address that is not one", { email: "ana@" }],
    ["a phone that is not one", { phone: "12" }],
    ["an empty name", { firstName: "  " }],
    ["not an object at all", null],
  ])("%s is refused", async (_label, over) => {
    const answer = await actions.savePublicDraft(
      null,
      over === null ? "x" : details(over),
    );
    expect(answer).toEqual({ ok: false, error: "invalid" });
    expect(tables.bookings).toEqual([]);
  });

  test("the contact is linked only when it is this address's", async () => {
    await actions.savePublicDraft(null, details({ contactId: OTHERS_CONTACT }));
    expect(only().contact_id).toBeUndefined();
  });

  test("the draft this visit started is rewritten, not duplicated", async () => {
    tables.bookings.push(draftRow({ first_name: "Anna" }));
    const answer = await actions.savePublicDraft(
      null,
      details({ draftId: DRAFT }),
    );
    expect(answer).toEqual({ ok: true, bookingId: DRAFT });
    expect(only()).toMatchObject({ id: DRAFT, first_name: "Ana" });
  });

  test("a booking past being a draft is not rewritten, and keeps its id (the last step says it was confirmed)", async () => {
    tables.bookings.push(draftRow({ status: "pending", first_name: "Anna" }));
    const answer = await actions.savePublicDraft(
      null,
      details({ draftId: DRAFT }),
    );
    expect(answer).toEqual({ ok: true, bookingId: DRAFT });
    expect(only()).toMatchObject({ status: "pending", first_name: "Anna" });
  });

  test("a draft that is gone is started afresh", async () => {
    const answer = await actions.savePublicDraft(
      null,
      details({ draftId: DRAFT }),
    );
    expect(answer).toEqual({ ok: true, bookingId: fakeId(1) });
    expect(only().status).toBe("draft");
  });

  test("a database that does not answer is 'failed', and nothing is written", async () => {
    failure = { table: "service_tiers", kind: "select" };
    expect(await actions.savePublicDraft(null, details())).toEqual({
      ok: false,
      error: "failed",
    });
    expect(tables.bookings).toEqual([]);
  });

  test("a draft holds no slot: one on an hour a booking holds is written", async () => {
    tables.bookings.push({
      id: "held",
      status: "confirmed",
      staff_id: STAFF,
      date: "2099-08-20",
      time: "10:30",
      duration: "50 min",
    });
    const answer = await actions.savePublicDraft(null, details());
    expect(answer.ok).toBe(true);
  });
});

describe("the calendar sets the day and the hour of a draft, and only of a draft", () => {
  test("a draft gets them", async () => {
    tables.bookings.push(draftRow());
    expect(
      await actions.setPublicDraftTime({
        draftId: DRAFT,
        date: "2099-08-20",
        time: "10:30",
      }),
    ).toEqual({ ok: true });
    expect(only()).toMatchObject({ date: "2099-08-20", time: "10:30" });
  });

  test("a booking that is not a draft is left as it is", async () => {
    tables.bookings.push(
      draftRow({ status: "confirmed", date: "2099-01-01", time: "09:00" }),
    );
    await actions.setPublicDraftTime({
      draftId: DRAFT,
      date: "2099-08-20",
      time: "10:30",
    });
    expect(only()).toMatchObject({ date: "2099-01-01", time: "09:00" });
  });

  test.each([
    [{ draftId: "b-1", date: "2099-08-20", time: "10:30" }],
    [{ draftId: DRAFT, date: "20/08/2099", time: "10:30" }],
    [{ draftId: DRAFT, date: "2099-02-31", time: "10:30" }],
    [{ draftId: DRAFT, date: "2099-08-20", time: "25:00" }],
    [{ draftId: DRAFT, date: "2099-08-20", time: "10:30", status: "pending" }],
  ])("what is not a day and an hour is refused: %j", async (input) => {
    tables.bookings.push(draftRow());
    expect(await actions.setPublicDraftTime(input)).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(only().time).toBeNull();
  });
});

describe("the last step: the booking, and whether THIS call made it", () => {
  test("a draft is promoted to pending, once, with the server's price, and the history says so", async () => {
    tables.bookings.push(draftRow());
    const answer = await actions.confirmPublicBooking(null, confirmation());
    expect(answer).toEqual({ kind: "promoted", bookingId: DRAFT });
    expect(only()).toMatchObject({
      status: "pending",
      tier_id: TIER,
      duration: "50 min",
      price_eur: 81,
      payment_mode: "full",
      location: "centro",
      date: "2099-08-20",
      time: "10:30",
      staff_id: STAFF,
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      bookingId: DRAFT,
      event: "created",
      actorRole: "anonymous",
    });
    expect(String(events[0]!.summary)).toStartWith(
      "Reserva solicitada desde la web · Manual Therapies · ",
    );
  });

  test("a booking that is no longer a draft is left alone, and it says so", async () => {
    tables.bookings.push(draftRow({ status: "confirmed" }));
    expect(await actions.confirmPublicBooking(null, confirmation())).toEqual({
      kind: "not_draft",
    });
    expect(events).toEqual([]);
  });

  test("the second of two calls is the one that did not confirm", async () => {
    tables.bookings.push(draftRow());
    await actions.confirmPublicBooking(null, confirmation());
    expect(await actions.confirmPublicBooking(null, confirmation())).toEqual({
      kind: "not_draft",
    });
    expect(events).toHaveLength(1);
  });

  test("another tab that gets in between the read and the write wins: nothing is recorded twice", async () => {
    tables.bookings.push(draftRow());
    beforeUpdate = () => {
      tables.bookings[0]!.status = "pending";
      beforeUpdate = null;
    };
    expect(await actions.confirmPublicBooking(null, confirmation())).toEqual({
      kind: "not_draft",
    });
    expect(events).toEqual([]);
  });

  test("with no draft any more, a booking is written afresh: pending, priced by the server", async () => {
    const answer = await actions.confirmPublicBooking(
      "client-token",
      confirmation(),
    );
    expect(answer).toEqual({ kind: "created", bookingId: fakeId(1) });
    expect(only()).toMatchObject({
      status: "pending",
      price_eur: 81,
      payment_mode: "full",
      date: "2099-08-20",
      time: "10:30",
      user_id: CLIENT,
      created_by_role: "client",
      contact_id: CONTACT,
    });
  });

  test("a database that cannot be read or written is 'failed': nothing is concluded", async () => {
    tables.bookings.push(draftRow());
    failure = { table: "bookings", kind: "select" };
    expect(await actions.confirmPublicBooking(null, confirmation())).toEqual({
      kind: "failed",
    });
    failure = { table: "bookings", kind: "update" };
    expect(await actions.confirmPublicBooking(null, confirmation())).toEqual({
      kind: "failed",
    });
    expect(only().status).toBe("draft");
  });

  test.each([
    ["status", "confirmed"],
    ["price_eur", 0.01],
    ["payment_status", "paid"],
    ["payment_mode", "deposit"],
    ["user_id", CLIENT],
  ])(
    "a key the form does not send (%s) is refused, and nothing is promoted",
    async (key, value) => {
      tables.bookings.push(draftRow());
      expect(
        await actions.confirmPublicBooking(
          null,
          confirmation({ [key]: value }),
        ),
      ).toEqual({ kind: "invalid" });
      expect(only().status).toBe("draft");
    },
  );

  test("without a day, an hour or a session type it is refused", async () => {
    for (const over of [{ date: "" }, { time: "" }, { tierId: null }]) {
      expect(
        await actions.confirmPublicBooking(null, confirmation(over)),
      ).toEqual({ kind: "invalid" });
    }
  });
});

describe("the professional's hour, defended by the database", () => {
  const held = (over: Row = {}): Row => ({
    id: "held",
    status: "pending",
    staff_id: STAFF,
    date: "2099-08-20",
    time: "10:00",
    duration: "50 min",
    ...over,
  });

  test("a draft confirmed onto an hour another booking holds is 'slot_taken': it stays a draft and nothing is recorded", async () => {
    tables.bookings.push(held(), draftRow());
    expect(await actions.confirmPublicBooking(null, confirmation())).toEqual({
      kind: "slot_taken",
    });
    expect(tables.bookings.find((r) => r.id === DRAFT)?.status).toBe("draft");
    expect(events).toEqual([]);
  });

  test("written afresh onto a taken hour, the same", async () => {
    tables.bookings.push(held());
    expect(
      await actions.confirmPublicBooking(null, confirmation({ draftId: null })),
    ).toEqual({ kind: "slot_taken" });
    expect(tables.bookings).toHaveLength(1);
  });

  test("two visitors on one hour: the first to confirm has it, the second is told", async () => {
    const SECOND = "99999999-9999-4999-8999-999999999999";
    tables.bookings.push(draftRow(), draftRow({ id: SECOND }));
    // Two visitors: each holds the claim on her own draft (one jar stands in
    // for both browsers here).
    jar = withClaim(jar, SECOND);
    expect(await actions.confirmPublicBooking(null, confirmation())).toEqual({
      kind: "promoted",
      bookingId: DRAFT,
    });
    expect(
      await actions.confirmPublicBooking(
        null,
        confirmation({ draftId: SECOND }),
      ),
    ).toEqual({ kind: "slot_taken" });
  });

  test("what does not hold an hour does not take it: a draft, a cancelled booking, another professional, back to back", async () => {
    tables.bookings.push(
      held({ id: "a", status: "draft", time: "10:30" }),
      held({ id: "b", status: "cancelled", time: "10:30" }),
      held({ id: "c", staff_id: STRANGER, time: "10:30" }),
      // 09:40 + 50 min ends at 10:30, when hers begins.
      held({ id: "d", time: "09:40" }),
      draftRow(),
    );
    expect(await actions.confirmPublicBooking(null, confirmation())).toEqual({
      kind: "promoted",
      bookingId: DRAFT,
    });
  });
});

describe("a draft is the browser's that started it", () => {
  test("the details step gives this browser the claim on the draft it writes", async () => {
    jar = null;
    const answer = await actions.savePublicDraft(null, details());
    expect(answer).toEqual({ ok: true, bookingId: fakeId(1) });
    expect(String(jar)).toContain(fakeId(1));
  });

  test("a draft id this browser holds no claim on is not rewritten: a new draft is started", async () => {
    jar = null;
    tables.bookings.push(draftRow({ first_name: "Stranger" }));
    const answer = await actions.savePublicDraft(
      null,
      details({ draftId: DRAFT }),
    );
    expect(answer).toEqual({ ok: true, bookingId: fakeId(1) });
    expect(tables.bookings.find((r) => r.id === DRAFT)?.first_name).toBe(
      "Stranger",
    );
  });

  test("its hour is not set from another browser", async () => {
    jar = null;
    tables.bookings.push(draftRow());
    expect(
      await actions.setPublicDraftTime({
        draftId: DRAFT,
        date: "2099-08-20",
        time: "10:30",
      }),
    ).toEqual({ ok: false, error: "not_yours" });
    expect(only().time).toBeNull();
  });

  test("nor is it confirmed from another browser: that browser gets a booking of its own, and the draft is left as it was", async () => {
    jar = null;
    tables.bookings.push(draftRow());
    const answer = await actions.confirmPublicBooking(null, confirmation());
    expect(answer).toEqual({ kind: "created", bookingId: fakeId(1) });
    expect(tables.bookings.find((r) => r.id === DRAFT)?.status).toBe("draft");
    expect(String(jar)).toContain(fakeId(1));
  });
});

describe("what the last step checks on the server", () => {
  test("a day already past (Canary time) is refused", async () => {
    tables.bookings.push(draftRow());
    expect(
      await actions.confirmPublicBooking(
        null,
        confirmation({ date: "2020-01-01" }),
      ),
    ).toEqual({ kind: "invalid" });
    expect(only().status).toBe("draft");
  });

  test("a session type switched off, or a service switched off, is not on sale", async () => {
    tables.bookings.push(draftRow());
    tables.service_tiers[0]!.active = false;
    expect(await actions.confirmPublicBooking(null, confirmation())).toEqual({
      kind: "invalid",
    });
    tables.service_tiers[0]!.active = true;
    tables.service_settings[0]!.active = false;
    expect(await actions.confirmPublicBooking(null, confirmation())).toEqual({
      kind: "invalid",
    });
    expect(only().status).toBe("draft");
  });

  test("an hour the professional's schedule does not offer, or has taken, is 'slot_taken' before anything is written", async () => {
    tables.bookings.push(draftRow());
    freeHours[STAFF] = ["09:00"];
    expect(await actions.confirmPublicBooking(null, confirmation())).toEqual({
      kind: "slot_taken",
    });
    expect(only().status).toBe("draft");
    // Her own draft does not take the hour from her.
    expect(availabilityAsked[0]).toEqual({
      staffId: STAFF,
      excludeDraftId: DRAFT,
    });
  });

  test("left to the centre, the first professional free at that hour is assigned, so the guard covers it", async () => {
    tables.bookings.push(draftRow({ staff_id: null }));
    freeHours[STAFF] = ["09:00"];
    const answer = await actions.confirmPublicBooking(
      null,
      confirmation({ staffId: null }),
    );
    expect(answer).toEqual({ kind: "promoted", bookingId: DRAFT });
    expect(only().staff_id).toBe(STAFF_2);
  });

  test("and when nobody has it free, the hour is taken", async () => {
    tables.bookings.push(draftRow({ staff_id: null }));
    freeHours = {};
    expect(
      await actions.confirmPublicBooking(null, confirmation({ staffId: null })),
    ).toEqual({ kind: "slot_taken" });
  });

  test("the service written is the session type's, with its name", async () => {
    tables.bookings.push(
      draftRow({ service_id: "made-up", service_title: "Made up" }),
    );
    await actions.confirmPublicBooking(null, confirmation());
    expect(only()).toMatchObject({
      service_id: "manual-therapies",
      service_title: "Manual Therapies",
    });
  });

  test("one address keeps a few bookings waiting for their payment, not more", async () => {
    for (const n of [1, 2, 3]) {
      tables.bookings.push({
        id: fakeId(100 + n),
        status: "pending",
        payment_status: "pending",
        email: n === 2 ? "ANA@example.com" : "ana@example.com",
      });
    }
    tables.bookings.push(draftRow());
    expect(await actions.confirmPublicBooking(null, confirmation())).toEqual({
      kind: "too_many_pending",
    });
    // A paid one, or another address's, does not count.
    tables.bookings[0]!.payment_status = "paid";
    expect(
      (await actions.confirmPublicBooking(null, confirmation())).kind,
    ).toBe("promoted");
  });
});

describe("the rate limits, per address", () => {
  const deps = () => ({
    visitor: { claims: jar, ip: "203.0.113.7" },
    limiters: core.createPublicLimiters(),
  });

  test("a few drafts in ten minutes, then 'rate_limited' with nothing written", async () => {
    const d = deps();
    for (let i = 0; i < core.PUBLIC_LIMITS.draft; i++) {
      expect((await core.savePublicDraftCore(null, details(), d)).ok).toBe(
        true,
      );
    }
    expect(await core.savePublicDraftCore(null, details(), d)).toEqual({
      ok: false,
      error: "rate_limited",
    });
    expect(tables.bookings).toHaveLength(core.PUBLIC_LIMITS.draft);
    // Another address is not held back by this one.
    expect(
      (
        await core.savePublicDraftCore(null, details(), {
          ...d,
          visitor: { claims: null, ip: "203.0.113.8" },
        })
      ).ok,
    ).toBe(true);
  });

  test("the confirmations too", async () => {
    const d = deps();
    for (let i = 0; i < core.PUBLIC_LIMITS.confirm; i++) {
      await core.confirmPublicBookingCore(
        null,
        confirmation({ draftId: null, date: `2099-08-${10 + i}` }),
        d,
      );
    }
    expect(
      await core.confirmPublicBookingCore(null, confirmation(), d),
    ).toEqual({ kind: "rate_limited" });
  });
});
