import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import { bookableServices } from "@/data/services-data";
import {
  fakeBookingsDb,
  fakeId,
  type FakeTables,
} from "@/lib/bookings/fake-bookings-db";
import { withClaim } from "@/lib/bookings/draft-claim";
import type { DetailsState } from "@/types";

/**
 * The public booking form from the details step to the payment, END TO END:
 * the real `booking-submit` (the browser's side) calling the real server
 * actions of `app/actions/public-booking.ts`, with only the edges replaced:
 * the database (an in-memory copy that keeps the rule of
 * `bookings_no_overlap`, with the contact functions answered as the database
 * would), the session check, the history, the emails and the checkout. The
 * browser's client is replaced by one that throws: the form reaches the
 * database only through the server's actions, the contact's included
 * (`app/actions/public-contact.ts`).
 *
 * What it shows: a guest still books exactly as before, and the booking the
 * server writes is the one she chose, priced by the server; and when another
 * visitor confirms the same hour of the same professional a moment later, she
 * is told the hour is taken and NO payment is opened for her.
 *
 * Modules are put back afterwards: `mock.module` is process-wide.
 */

const TIER = "11111111-1111-4111-8111-111111111111";
const STAFF = "33333333-3333-4333-8333-333333333333";
const CONTACT_A = "55555555-5555-4555-8555-555555555555";
const CONTACT_B = "66666666-6666-4666-8666-666666666666";

// The claim cookie is signed with a server secret; the tests have no keys.
process.env.BOOKING_CLAIM_SECRET ??= "test-booking-claim-secret";

type Call = { name: string; args: unknown[] };
type Rpc = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: unknown }>;
/** The browser's cookie of claims (`draft-claim.ts`), as the actions keep it. */
let jar: string | null = null;
let calls: Call[] = [];
let tables: FakeTables;

const realFetch = globalThis.fetch;
const real = {
  session: { ...(await import("@/lib/client-session")) },
  notifications: { ...(await import("@/actions/booking-notifications")) },
  consent: { ...(await import("@/actions/whatsapp-consent")) },
  admin: { ...(await import("@/lib/insforge-admin")) },
  guard: { ...(await import("@/lib/auth-guard")) },
  record: { ...(await import("@/lib/booking-events/record")) },
  publicBooking: { ...(await import("@/actions/public-booking")) },
  publicContact: { ...(await import("@/actions/public-contact")) },
  visitor: { ...(await import("@/lib/bookings/visitor")) },
  availability: { ...(await import("@/actions/availability")) },
};

let submit: typeof import("./booking-submit");

beforeAll(async () => {
  // The browser's client: nothing at all. A read, a write or a function
  // called with the browser's key would throw here.
  const noBrowserClient = () => {
    throw new Error("the browser's database client was used");
  };
  mock.module("@/lib/insforge", () => ({
    insforge: { database: { from: noBrowserClient, rpc: noBrowserClient } },
  }));
  mock.module("@/lib/client-session", () => ({
    ...real.session,
    getAccessToken: () => null,
  }));
  mock.module("@/actions/booking-notifications", () => ({
    ...real.notifications,
    notifyBooking: (...args: unknown[]) => {
      calls.push({ name: "notifyBooking", args });
      return Promise.resolve({ ok: true });
    },
  }));
  mock.module("@/actions/whatsapp-consent", () => ({
    ...real.consent,
    saveBookingConsents: () => Promise.resolve({ ok: true }),
  }));
  mock.module("@/lib/insforge-admin", () => ({
    ...real.admin,
    getAdminClient: () => {
      const { db } = fakeBookingsDb(tables);
      const promote = (db as unknown as { rpc: Rpc }).rpc;
      // The member check, called with the SERVICE key by the contact's
      // action; the promotion as its SQL does it (`fakeBookingsDb`).
      const rpc: Rpc = (name, args) => {
        calls.push({ name: `rpc:${name}`, args: [args] });
        if (name === "check_email_role") {
          return Promise.resolve({ data: "lead", error: null });
        }
        return promote(name, args);
      };
      return { database: Object.assign(db, { rpc }) };
    },
  }));
  mock.module("@/lib/auth-guard", () => ({
    ...real.guard,
    authenticate: async () => {
      throw new real.guard.AuthError("Authentication required", 401);
    },
  }));
  mock.module("@/lib/booking-events/record", () => ({
    ...real.record,
    recordBookingEvent: async (event: unknown) => {
      calls.push({ name: "history", args: [event] });
    },
  }));
  mock.module("@/lib/bookings/visitor", () => ({
    ...real.visitor,
    readVisitor: async () => ({ claims: jar, ip: null }),
    rememberClaim: async (_visitor: unknown, bookingId: string) => {
      jar = withClaim(jar, bookingId);
    },
  }));
  // The professional's schedule offers the morning; what is booked is the
  // database's to refuse.
  mock.module("@/actions/availability", () => ({
    ...real.availability,
    fetchAvailability: async (input: { from: string }) => ({
      [input.from]: ["10:30", "11:20"],
    }),
  }));
  // The real actions, whatever another test file left registered.
  mock.module("@/actions/public-booking", () => real.publicBooking);
  mock.module("@/actions/public-contact", () => real.publicContact);
  submit = await import("./booking-submit");
});

afterAll(() => {
  globalThis.fetch = realFetch;
  mock.module("@/lib/client-session", () => real.session);
  mock.module("@/actions/booking-notifications", () => real.notifications);
  mock.module("@/actions/whatsapp-consent", () => real.consent);
  mock.module("@/lib/insforge-admin", () => real.admin);
  mock.module("@/lib/auth-guard", () => real.guard);
  mock.module("@/lib/booking-events/record", () => real.record);
  mock.module("@/lib/bookings/visitor", () => real.visitor);
  mock.module("@/actions/availability", () => real.availability);
});

beforeEach(() => {
  calls = [];
  jar = null;
  tables = {
    bookings: [],
    service_tiers: [
      {
        id: TIER,
        service_id: "manual-therapies",
        duration_minutes: 50,
        price_eur: 81,
        price_center_eur: 90,
        active: true,
      },
    ],
    staff_tiers: [{ tier_id: TIER, staff_id: STAFF }],
    contacts: [
      { id: CONTACT_A, email: "ana@example.com" },
      { id: CONTACT_B, email: "bea@example.com" },
    ],
    service_settings: [{ id: "manual-therapies", active: true }],
  };
  globalThis.fetch = ((url: unknown, init?: { body?: string }) => {
    calls.push({
      name: "checkout",
      args: [url, JSON.parse(init?.body ?? "{}")],
    });
    return Promise.resolve(
      new Response(JSON.stringify(REDSYS), { status: 200 }),
    );
  }) as unknown as typeof fetch;
});

/** What the checkout answers: the form the browser posts to the bank. */
const REDSYS = {
  formUrl: "https://redsys.example/pay",
  Ds_MerchantParameters: "params",
  Ds_Signature: "signature",
  Ds_SignatureVersion: "HMAC_SHA256_V1",
  orderId: "o-1",
};

const SERVICE = bookableServices.find((s) => s.id === "manual-therapies")!;

const person = (first: string, email: string): DetailsState => ({
  firstName: first,
  lastName: "García",
  email,
  phone: "600000000",
  consent: true,
  newsletter: false,
  notes: "",
});

const draftOf = (details: DetailsState) => ({
  service: SERVICE,
  tierId: TIER,
  tierLabel: "Drenaje",
  tierPrice: 90,
  // What the browser holds is not what is charged: the server reads the tier.
  tierPriceOnline: 1,
  duration: "50 min",
  staffId: STAFF,
  date: new Date(2099, 7, 20),
  time: "10:30",
  details,
});

/** A visitor's whole way through: details, calendar, confirmation. */
async function book(details: DetailsState) {
  const draft = draftOf(details);
  const saved = await submit.saveDetailsStep({
    user: null,
    locale: "es",
    draft,
    contactId: null,
    bookingId: null,
  });
  if (saved.kind !== "saved") throw new Error("not saved");
  await submit.saveDatetimeStep(saved.bookingId, draft.date, draft.time);
  const result = await submit.confirmBooking({
    locale: "es",
    draft,
    contactId: saved.contactId,
    bookingId: saved.bookingId,
    paymentDescription: "Terapias manuales",
  });
  return { saved, result };
}

describe("the public form, end to end, with the browser writing no booking", () => {
  test("a guest books as before: her draft becomes a pending booking, priced by the server, and the payment opens on it", async () => {
    const { saved, result } = await book(person("Ana", "ana@example.com"));
    expect(saved).toEqual({
      kind: "saved",
      contactId: CONTACT_A,
      bookingId: fakeId(1),
    });
    expect(result).toEqual({
      kind: "redsys",
      formData: REDSYS,
    });
    expect(tables.bookings).toHaveLength(1);
    expect(tables.bookings[0]).toMatchObject({
      id: fakeId(1),
      status: "pending",
      service_id: "manual-therapies",
      service_title: "Manual Therapies",
      tier_id: TIER,
      staff_id: STAFF,
      date: "2099-08-20",
      time: "10:30",
      duration: "50 min",
      price_eur: 81,
      payment_mode: "full",
      location: "centro",
      contact_id: CONTACT_A,
      email: "ana@example.com",
      created_by_role: "anonymous",
    });
    expect(tables.bookings[0]!.payment_status).toBeUndefined();
    const checkout = calls.find((c) => c.name === "checkout")!;
    expect(checkout.args[0]).toBe("/api/checkout/booking-session");
    // The booking id and nothing that prices it: the session type is the
    // booking's own, read by the checkout.
    expect(checkout.args[1]).toMatchObject({ bookingId: fakeId(1) });
    expect(checkout.args[1]).not.toHaveProperty("tierId");
    // And this browser holds the claim the checkout will ask for.
    expect(String(jar)).toContain(fakeId(1));
    expect(calls.filter((c) => c.name === "history")).toHaveLength(1);
    // Her address asked about on the server (the role never reaches the
    // browser), her contact found there the public way (it is on file, so
    // nothing of it is rewritten: no `upsert_contact`), and made a client
    // once her booking exists.
    expect(
      calls.filter((c) => c.name.startsWith("rpc:")).map((c) => c.name),
    ).toEqual(["rpc:check_email_role", "rpc:promote_contact_to_client"]);
    const contact = tables.contacts.find((c) => c.id === CONTACT_A);
    expect(contact?.status).toBe("client");
    expect(contact).not.toHaveProperty("first_name");
    expect(contact).not.toHaveProperty("phone");
    // "Received" goes out once the payment is open.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calls.filter((c) => c.name === "notifyBooking")).toHaveLength(1);
  });

  test("a second visitor on the same hour of the same professional is told it is taken, and no payment is opened for her", async () => {
    await book(person("Ana", "ana@example.com"));
    calls = [];
    const { saved, result } = await book(person("Bea", "bea@example.com"));
    expect(result).toEqual({ kind: "slotTaken" });
    expect(calls.map((c) => c.name)).not.toContain("checkout");
    expect(calls.map((c) => c.name)).not.toContain("notifyBooking");
    expect(calls.map((c) => c.name)).not.toContain(
      "rpc:promote_contact_to_client",
    );
    expect(tables.contacts.find((c) => c.id === CONTACT_B)?.status).toBe(
      undefined,
    );
    // Her draft is still hers, to pick another hour with.
    expect(tables.bookings.find((r) => r.id === saved.bookingId)).toMatchObject(
      { status: "draft", date: "2099-08-20", time: "10:30" },
    );
    // Ana's booking stands as it was.
    expect(tables.bookings.find((r) => r.id === fakeId(1))?.status).toBe(
      "pending",
    );
  });

  test("the second visitor, on another hour, books as the first did", async () => {
    await book(person("Ana", "ana@example.com"));
    const draft = draftOf(person("Bea", "bea@example.com"));
    const saved = await submit.saveDetailsStep({
      user: null,
      locale: "es",
      draft,
      contactId: null,
      bookingId: null,
    });
    if (saved.kind !== "saved") throw new Error("not saved");
    // 11:20: Ana's 10:30 + 50 minutes ends there.
    const later = { ...draft, time: "11:20" };
    await submit.saveDatetimeStep(saved.bookingId, later.date, later.time);
    const result = await submit.confirmBooking({
      locale: "es",
      draft: later,
      contactId: saved.contactId,
      bookingId: saved.bookingId,
      paymentDescription: "Terapias manuales",
    });
    expect(result.kind).toBe("redsys");
    expect(
      tables.bookings.filter((r) => r.status === "pending").map((r) => r.time),
    ).toEqual(["10:30", "11:20"]);
  });
});
