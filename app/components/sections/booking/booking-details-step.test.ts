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
  if (name === "create_draft_booking") {
    return Promise.resolve({ data: "booking-1", error: null });
  }
  return Promise.resolve({ data: null, error: null });
};

// The browser client is not among them: it cannot be loaded without the
// project's keys, which the tests deliberately do not have, so there is no real
// module to keep or to put back.
const realFetch = globalThis.fetch;

const real = {
  session: { ...(await import("@/lib/client-session")) },
  draft: { ...(await import("@/actions/booking-draft")) },
  notifications: { ...(await import("@/actions/booking-notifications")) },
  consent: { ...(await import("@/actions/whatsapp-consent")) },
};

let saveDetailsStep: typeof import("./booking-submit").saveDetailsStep;
let confirmBooking: typeof import("./booking-submit").confirmBooking;

beforeAll(async () => {
  mock.module("@/lib/insforge", () => ({ insforge: { database: { rpc } } }));
  mock.module("@/lib/client-session", () => ({
    ...real.session,
    getAccessToken: () => "token",
  }));
  mock.module("@/actions/booking-draft", () => ({
    ...real.draft,
    updateDraftBookingMeta: record("updateDraftBookingMeta"),
    updateDraftBookingDetails: record("updateDraftBookingDetails"),
    confirmDraftBooking: record("confirmDraftBooking"),
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
  mock.module("@/actions/booking-draft", () => real.draft);
  mock.module("@/actions/booking-notifications", () => real.notifications);
  mock.module("@/actions/whatsapp-consent", () => real.consent);
});

beforeEach(() => {
  calls = [];
  role = "lead";
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
  paymentMode: "deposit" as const,
});

const names = () => calls.map((c) => c.name);
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
      "rpc:create_draft_booking",
      "updateDraftBookingMeta",
      "saveBookingConsents",
    ]);
    expect(argsOf("rpc:upsert_contact")).toMatchObject({
      p_email: "ana@example.com",
      p_newsletter: true,
      p_whatsapp_marketing: true,
    });
    expect(argsOf("rpc:create_draft_booking")).toMatchObject({
      p_contact_id: "contact-1",
      p_email: "ana@example.com",
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
      "rpc:create_draft_booking",
      "updateDraftBookingMeta",
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
    expect(names()).toEqual([
      "rpc:create_draft_booking",
      "updateDraftBookingMeta",
      "saveBookingConsents",
    ]);
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
      "rpc:create_draft_booking",
      "updateDraftBookingMeta",
      "saveBookingConsents",
    ]);
    expect(argsOf("rpc:upsert_contact")).toMatchObject({
      p_email: "ana@example.com",
      p_first_name: "Ana",
      p_phone: "600000000",
      p_newsletter: true,
      p_whatsapp_marketing: true,
    });
    expect(argsOf("rpc:create_draft_booking")).toMatchObject({
      p_contact_id: "contact-1",
      p_user_id: "u1",
    });
    // The token still travels: it is the server that decides, from the
    // verified session, that this is not her own contact.
    expect(calls.at(-1)?.args[0]).toBe("token");
    expect(calls.at(-1)?.args[1]).toMatchObject({ email: "ana@example.com" });
  });
});

describe("confirmBooking: the last gate before the payment", () => {
  const confirm = (details: DetailsState) =>
    confirmBooking({
      user: null,
      locale: "es",
      draft: { ...draft(details), service: SERVICE },
      contactId: "contact-1",
      bookingId: "booking-1",
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
      "confirmDraftBooking",
      "rpc:promote_contact_to_client",
      "fetch",
    ]);
  });
});
