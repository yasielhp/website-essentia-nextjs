import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import type { DetailsState } from "@/types";

/**
 * `saveDetailsStep`, run for real with the browser's database client and the
 * server actions replaced. What is under test is WHO gets written when the
 * visitor presses "next" on her details: the contact, the draft and the
 * consents, for a guest, for a member who chose to go on as a guest, and for a
 * signed-in client.
 *
 * Modules are put back afterwards: `mock.module` is process-wide.
 */

type Call = { name: string; args: unknown[] };
let calls: Call[] = [];
let role: string | null = "lead";
/** What the server says when the form asks it to confirm the booking. */
let promotion: unknown = { kind: "promoted", bookingId: "booking-1" };

const record =
  (name: string, result: unknown = undefined) =>
  (...args: unknown[]) => {
    calls.push({ name, args });
    return Promise.resolve(result);
  };

const rpc = (name: string, args: unknown) => {
  calls.push({ name: `rpc:${name}`, args: [args] });
  if (name === "check_email_role") {
    return Promise.resolve({ data: role, error: null });
  }
  if (name === "upsert_contact") {
    return Promise.resolve({ data: "contact-1", error: null });
  }
  return Promise.resolve({ data: null, error: null });
};

// The browser client is not among them: it cannot be loaded without the
// project's keys, which the tests deliberately do not have, so there is no real
// module to keep or to put back.
const realFetch = globalThis.fetch;

const real = {
  session: { ...(await import("@/lib/client-session")) },
  publicBooking: { ...(await import("@/actions/public-booking")) },
  notifications: { ...(await import("@/actions/booking-notifications")) },
  consent: { ...(await import("@/actions/whatsapp-consent")) },
};

let saveDetailsStep: typeof import("./booking-submit").saveDetailsStep;
let confirmBooking: typeof import("./booking-submit").confirmBooking;

beforeAll(async () => {
  // No `from`: the form writes no table from the browser any more. A call to
  // it would throw here, and the test with it.
  mock.module("@/lib/insforge", () => ({
    insforge: { database: { rpc } },
  }));
  mock.module("@/lib/client-session", () => ({
    ...real.session,
    getAccessToken: () => "token",
  }));
  mock.module("@/actions/public-booking", () => ({
    ...real.publicBooking,
    savePublicDraft: (token: unknown, input: { draftId: string | null }) => {
      calls.push({ name: "savePublicDraft", args: [token, input] });
      return Promise.resolve({
        ok: true,
        bookingId: input.draftId ?? "booking-1",
      });
    },
    setPublicDraftTime: record("setPublicDraftTime", { ok: true }),
    confirmPublicBooking: (...args: unknown[]) => {
      calls.push({ name: "confirmPublicBooking", args });
      return Promise.resolve(promotion);
    },
  }));
  mock.module("@/actions/booking-notifications", () => ({
    ...real.notifications,
    notifyBooking: record("notifyBooking"),
  }));
  mock.module("@/actions/whatsapp-consent", () => ({
    ...real.consent,
    saveBookingConsents: record("saveBookingConsents", { ok: true }),
  }));
  ({ saveDetailsStep, confirmBooking } = await import("./booking-submit"));
});

afterAll(() => {
  globalThis.fetch = realFetch;
  mock.module("@/lib/client-session", () => real.session);
  mock.module("@/actions/public-booking", () => real.publicBooking);
  mock.module("@/actions/booking-notifications", () => real.notifications);
  mock.module("@/actions/whatsapp-consent", () => real.consent);
});

beforeEach(() => {
  calls = [];
  role = "lead";
  promotion = { kind: "promoted", bookingId: "booking-1" };
  // The checkout: refused, so a confirmation that gets that far ends "unpaid".
  globalThis.fetch = ((...args: unknown[]) => {
    calls.push({ name: "fetch", args });
    return Promise.resolve(new Response("{}", { status: 500 }));
  }) as unknown as typeof fetch;
});

const DETAILS: DetailsState = {
  firstName: "Ana",
  lastName: "García",
  email: "ana@example.com",
  phone: "600000000",
  consent: true,
  newsletter: true,
  notes: "",
};

const SERVICE = {
  id: "manual-therapies",
  title: "Manual Therapies",
} as NonNullable<Parameters<typeof confirmBooking>[0]["draft"]["service"]>;

const draft = (details: DetailsState = DETAILS) => ({
  service: null as typeof SERVICE | null,
  tierId: "tier-1",
  tierLabel: "Drenaje",
  tierPrice: 60,
  tierPriceOnline: 55,
  duration: "60 min",
  staffId: null,
  date: null,
  time: null,
  details,
});

const names = () => calls.map((c) => c.name);
/** What the details step sent the server for the draft. */
const draftSent = () =>
  calls.find((c) => c.name === "savePublicDraft")?.args[1] as Record<
    string,
    unknown
  >;
const argsOf = (name: string) =>
  calls.find((c) => c.name === name)?.args[0] as Record<string, unknown>;
/** The consent writes are not awaited by the step: let them start. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("saveDetailsStep, a guest", () => {
  test("her contact, her draft and her consents are written", async () => {
    const result = await saveDetailsStep({
      user: null,
      locale: "es",
      draft: draft(),
      contactId: null,
      bookingId: null,
    });
    await settle();
    expect(result).toEqual({
      kind: "saved",
      contactId: "contact-1",
      bookingId: "booking-1",
    });
    expect(names()).toEqual([
      "rpc:check_email_role",
      "rpc:upsert_contact",
      "savePublicDraft",
      "saveBookingConsents",
    ]);
    expect(argsOf("rpc:upsert_contact")).toMatchObject({
      p_email: "ana@example.com",
      p_newsletter: true,
      p_whatsapp_marketing: true,
    });
    // What she chose and nothing else: no status, price or account.
    expect(draftSent()).toEqual({
      draftId: null,
      contactId: "contact-1",
      serviceId: "",
      tierId: "tier-1",
      staffId: null,
      firstName: "Ana",
      lastName: "García",
      email: "ana@example.com",
      phone: "600000000",
      notes: null,
    });
    // One consent action, with no token: a guest has no session.
    expect(calls.at(-1)?.args).toEqual([
      null,
      {
        email: "ana@example.com",
        firstName: "Ana",
        lastName: "García",
        phone: "600000000",
        language: "es",
        marketing: true,
        termsAccepted: true,
      },
    ]);
  });

  test("an address that belongs to a member stops at the notice, with nothing written", async () => {
    role = "member";
    const result = await saveDetailsStep({
      user: null,
      locale: "es",
      draft: draft(),
      contactId: null,
      bookingId: null,
    });
    await settle();
    expect(result).toEqual({ kind: "member" });
    expect(names()).toEqual(["rpc:check_email_role"]);
  });
});

describe("saveDetailsStep, a booking picked up again", () => {
  test("with the draft this visit had started, that draft is rewritten and no second one is created", async () => {
    const result = await saveDetailsStep({
      user: null,
      locale: "es",
      draft: draft(),
      contactId: null,
      bookingId: "booking-0",
    });
    await settle();
    expect(result).toEqual({
      kind: "saved",
      contactId: "contact-1",
      bookingId: "booking-0",
    });
    expect(names()).toEqual([
      "rpc:check_email_role",
      "rpc:upsert_contact",
      "savePublicDraft",
      "saveBookingConsents",
    ]);
    expect(draftSent().draftId).toBe("booking-0");
  });
});

describe("saveDetailsStep, a member who goes on as a guest", () => {
  test("she is saved like any other guest and not asked again", async () => {
    role = "member";
    const result = await saveDetailsStep({
      user: null,
      locale: "es",
      draft: draft(),
      contactId: null,
      bookingId: null,
      asGuest: true,
    });
    await settle();
    expect(result).toEqual({
      kind: "saved",
      contactId: "contact-1",
      bookingId: "booking-1",
    });
    expect(names()).toEqual([
      "rpc:upsert_contact",
      "savePublicDraft",
      "saveBookingConsents",
    ]);
    // Her "news and offers" tick is not lost on the way.
    expect(argsOf("rpc:upsert_contact")).toMatchObject({
      p_newsletter: true,
      p_whatsapp_marketing: true,
    });
  });
});

describe("saveDetailsStep, a signed-in client", () => {
  test("the browser writes no contact: her own is the server's to find, in one action with her token", async () => {
    const result = await saveDetailsStep({
      user: { id: "u1", email: "Ana@Example.com" },
      locale: "en",
      draft: draft(),
      contactId: null,
      bookingId: null,
    });
    await settle();
    expect(result).toEqual({
      kind: "saved",
      contactId: null,
      bookingId: "booking-1",
    });
    expect(names()).toEqual(["savePublicDraft", "saveBookingConsents"]);
    // Her account is the one her token proves, on the server: the browser
    // sends no account id with the draft.
    expect(calls[0]?.args[0]).toBe("token");
    expect(draftSent()).not.toHaveProperty("userId");
    expect(draftSent().contactId).toBeNull();
    expect(calls.at(-1)?.args[0]).toBe("token");
    expect(calls.at(-1)?.args[1]).toMatchObject({
      language: "en",
      marketing: true,
      termsAccepted: true,
    });
  });

  test("with ANOTHER address in the form, that person's contact is written as a guest's and the draft points at it", async () => {
    const result = await saveDetailsStep({
      user: { id: "u1", email: "staff@example.com" },
      locale: "es",
      draft: draft(),
      contactId: null,
      bookingId: null,
    });
    await settle();
    expect(result).toEqual({
      kind: "saved",
      contactId: "contact-1",
      bookingId: "booking-1",
    });
    // No member notice for somebody who is already signed in.
    expect(names()).toEqual([
      "rpc:upsert_contact",
      "savePublicDraft",
      "saveBookingConsents",
    ]);
    expect(argsOf("rpc:upsert_contact")).toMatchObject({
      p_email: "ana@example.com",
      p_first_name: "Ana",
      p_phone: "600000000",
      p_newsletter: true,
      p_whatsapp_marketing: true,
    });
    expect(draftSent()).toMatchObject({ contactId: "contact-1" });
    expect(calls.find((c) => c.name === "savePublicDraft")?.args[0]).toBe(
      "token",
    );
    // The token still travels: it is the server that decides, from the
    // verified session, that this is not her own contact.
    expect(calls.at(-1)?.args[0]).toBe("token");
    expect(calls.at(-1)?.args[1]).toMatchObject({ email: "ana@example.com" });
  });
});

describe("confirmBooking: the last gate before the payment", () => {
  const confirm = (details: DetailsState, promotedHere = false) =>
    confirmBooking({
      locale: "es",
      draft: { ...draft(details), service: SERVICE },
      contactId: "contact-1",
      bookingId: "booking-1",
      promotedHere,
      paymentDescription: "Terapias manuales",
    });

  test("without the terms box ticked nothing is confirmed, promoted or charged", async () => {
    const result = await confirm({ ...DETAILS, consent: false });
    await settle();
    expect(result).toEqual({
      kind: "incomplete",
      errors: { consent: "consentRequired" },
    });
    expect(names()).toEqual([]);
  });

  test("any other detail that is wrong stops it too, each with its own error", async () => {
    const result = await confirm({ ...DETAILS, phone: "12", lastName: "" });
    expect(result).toEqual({
      kind: "incomplete",
      errors: { phone: "phoneInvalid", lastName: "lastNameRequired" },
    });
    expect(names()).toEqual([]);
  });

  test("with her details in order it goes on to confirm the draft and open the payment", async () => {
    const result = await confirm(DETAILS);
    await settle();
    expect(result).toEqual({ kind: "unpaid" });
    expect(names()).toEqual([
      "confirmPublicBooking",
      "rpc:promote_contact_to_client",
      "fetch",
    ]);
    // The token, and what she chose: the server decides status and price.
    const [token, sent] = calls[0]!.args as [unknown, Record<string, unknown>];
    expect(token).toBe("token");
    expect(Object.keys(sent).sort()).toEqual(
      [
        "contactId",
        "date",
        "draftId",
        "email",
        "firstName",
        "lastName",
        "notes",
        "phone",
        "serviceId",
        "staffId",
        "tierId",
        "time",
      ].sort(),
    );
  });

  test("an hour another booking took a moment ago opens no payment: she is sent back to choose", async () => {
    promotion = { kind: "slot_taken" };
    const result = await confirm(DETAILS);
    await settle();
    expect(result).toEqual({ kind: "slotTaken" });
    // Asked, and stopped there: no contact promoted, no checkout, no email.
    expect(names()).toEqual(["confirmPublicBooking"]);
  });

  test("a booking that was already confirmed elsewhere gets no payment opened on it", async () => {
    promotion = { kind: "not_draft" };
    const result = await confirm(DETAILS);
    await settle();
    expect(result).toEqual({ kind: "alreadyConfirmed" });
    // Asked, and stopped there: nobody is promoted, nothing is charged.
    expect(names()).toEqual(["confirmPublicBooking"]);
  });

  test("the booking this visit itself confirmed can have its payment opened again", async () => {
    // She closed the payment page and presses Confirm once more: the booking
    // is hers and already pending, so the server is not asked to confirm it
    // again and its "not a draft" does not turn her away.
    promotion = { kind: "not_draft" };
    const result = await confirm(DETAILS, true);
    await settle();
    expect(result).toEqual({ kind: "unpaid" });
    expect(names()).toEqual(["rpc:promote_contact_to_client", "fetch"]);
  });

  test("a draft that is not there any more is booked afresh by the server, and paid on its new id", async () => {
    promotion = { kind: "created", bookingId: "booking-new" };
    const result = await confirm(DETAILS);
    await settle();
    expect(result).toEqual({ kind: "unpaid" });
    expect(names()).toEqual([
      "confirmPublicBooking",
      "rpc:promote_contact_to_client",
      "fetch",
    ]);
    const body = JSON.parse(
      (calls.at(-1)?.args[1] as { body: string }).body,
    ) as { bookingId: string };
    expect(body.bookingId).toBe("booking-new");
  });

  test("a booking paid already opens no new charge, sends no 'received' and says it is paid", async () => {
    globalThis.fetch = ((...args: unknown[]) => {
      calls.push({ name: "fetch", args });
      return Promise.resolve(
        new Response(
          JSON.stringify({
            error: "Booking is already paid",
            code: "already_paid",
          }),
          { status: 409 },
        ),
      );
    }) as unknown as typeof fetch;
    const result = await confirm(DETAILS, true);
    await settle();
    expect(result).toEqual({ kind: "alreadyPaid" });
    expect(names()).not.toContain("notifyBooking");
  });

  test("any other refusal of the checkout (a booking released) is still 'unpaid'", async () => {
    globalThis.fetch = ((...args: unknown[]) => {
      calls.push({ name: "fetch", args });
      return Promise.resolve(
        new Response(JSON.stringify({ error: "Booking is no longer open" }), {
          status: 409,
        }),
      );
    }) as unknown as typeof fetch;
    const result = await confirm(DETAILS, true);
    expect(result).toEqual({ kind: "unpaid" });
  });

  test("a confirmation the server could not make opens no payment: she is told, and may try again", async () => {
    for (const kind of ["failed", "invalid"]) {
      calls = [];
      promotion = { kind };
      expect(await confirm(DETAILS)).toEqual({ kind: "failed" });
      expect(names()).toEqual(["confirmPublicBooking"]);
    }
  });

  test("too many attempts, or too many bookings waiting to be paid, open no payment either", async () => {
    for (const kind of ["rate_limited", "too_many_pending"]) {
      calls = [];
      promotion = { kind };
      expect(await confirm(DETAILS)).toEqual({ kind: "busy" });
      expect(names()).toEqual(["confirmPublicBooking"]);
    }
  });
});
