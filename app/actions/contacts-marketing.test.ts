import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import { fakeDb, type Row } from "@/lib/whatsapp/fake-contacts-db";

/**
 * `setMarketingConsent` run for real with its role check, its database and the
 * Resend list replaced. What is under test is WHO may call it, what reaches the
 * database and the list, and that it never throws or leaks the database's text.
 * The patches themselves are in `marketing-consent.test.ts`.
 *
 * Modules are put back afterwards: `mock.module` is process-wide.
 */

const ID = "11111111-1111-4111-8111-111111111111";
let rows: Row[] = [];
let allowed = true;
let dbFails: "read" | "write" | undefined;
let resendThrows = false;
let resendOk = true;
let resend: { email: string; subscribed: boolean }[] = [];
let adminCalls = 0;

const real = {
  admin: { ...(await import("@/lib/insforge-admin")) },
  guard: { ...(await import("@/lib/auth-guard")) },
  newsletter: { ...(await import("@/lib/newsletter")) },
};

let setMarketingConsent: typeof import("@/actions/contacts").setMarketingConsent;

beforeAll(async () => {
  mock.module("@/lib/insforge-admin", () => ({
    ...real.admin,
    getAdminClient: () => {
      adminCalls += 1;
      return { database: fakeDb(rows, { failOn: dbFails }).db };
    },
  }));
  mock.module("@/lib/auth-guard", () => ({
    ...real.guard,
    requireRole: async () => {
      if (!allowed)
        throw new real.guard.AuthError("Insufficient permissions", 403);
      return { userId: "staff-1", email: "staff@example.com", role: "staff" };
    },
  }));
  mock.module("@/lib/newsletter", () => ({
    ...real.newsletter,
    setResendSubscription: async (email: string, subscribed: boolean) => {
      if (resendThrows) throw new Error("resend exploded");
      resend.push({ email, subscribed });
      return resendOk ? { ok: true } : { ok: false, error: "provider text" };
    },
  }));
  ({ setMarketingConsent } = await import("@/actions/contacts"));
});

afterAll(() => {
  mock.module("@/lib/insforge-admin", () => real.admin);
  mock.module("@/lib/auth-guard", () => real.guard);
  mock.module("@/lib/newsletter", () => real.newsletter);
});

const contact = (over: Row = {}): Row => ({
  id: ID,
  email: "Ana@Example.com",
  newsletter_subscribed: false,
  newsletter_subscribed_at: null,
  newsletter_unsubscribed_at: null,
  whatsapp_opted_in_at: null,
  whatsapp_marketing_opted_in_at: null,
  whatsapp_opted_out_at: null,
  ...over,
});

beforeEach(() => {
  rows = [contact()];
  allowed = true;
  dbFails = undefined;
  resendThrows = false;
  resendOk = true;
  resend = [];
  adminCalls = 0;
});

describe("setMarketingConsent", () => {
  test("turning it on subscribes the email, consents WhatsApp and puts the address on the list", async () => {
    const result = await setMarketingConsent("token", ID, true);
    expect(result.ok).toBe(true);
    expect(rows[0]).toMatchObject({ newsletter_subscribed: true });
    expect(rows[0].whatsapp_marketing_opted_in_at).not.toBeNull();
    expect(resend).toEqual([{ email: "ana@example.com", subscribed: true }]);
  });

  test("turning it off withdraws both and takes the address off the list, stamping no unsubscribe or STOP", async () => {
    rows[0] = contact({
      newsletter_subscribed: true,
      whatsapp_marketing_opted_in_at: "2026-01-01T00:00:00.000Z",
    });
    const result = await setMarketingConsent("token", ID, false);
    expect(result.ok).toBe(true);
    expect(rows[0]).toMatchObject({
      newsletter_subscribed: false,
      whatsapp_marketing_opted_in_at: null,
      newsletter_unsubscribed_at: null,
      whatsapp_opted_out_at: null,
    });
    expect(resend).toEqual([{ email: "ana@example.com", subscribed: false }]);
  });

  test("a contact with no address is recorded but never sent to the list", async () => {
    rows[0] = contact({ email: null });
    expect((await setMarketingConsent("token", ID, true)).ok).toBe(true);
    expect(resend).toEqual([]);
  });

  test("a list that throws does not fail the consent, and is reported as not synced", async () => {
    resendThrows = true;
    const result = await setMarketingConsent("token", ID, true);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.emailListSynced).toBe(false);
    expect(rows[0].newsletter_subscribed).toBe(true);
  });

  test("a list that refuses is reported as not synced, with nothing of the provider's text", async () => {
    resendOk = false;
    rows[0] = contact({
      newsletter_subscribed: true,
      whatsapp_marketing_opted_in_at: "2026-01-01T00:00:00.000Z",
    });
    const result = await setMarketingConsent("token", ID, false);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.emailListSynced).toBe(false);
    // The consent is withdrawn in the database all the same.
    expect(rows[0].whatsapp_marketing_opted_in_at).toBeNull();
    expect(JSON.stringify(result)).not.toContain("provider text");
  });

  test("a list that follows is reported as synced, and so is a contact with no address", async () => {
    const synced = await setMarketingConsent("token", ID, true);
    expect(synced.ok && synced.emailListSynced).toBe(true);
    rows[0] = contact({ email: null });
    const noAddress = await setMarketingConsent("token", ID, true);
    expect(noAddress.ok && noAddress.emailListSynced).toBe(true);
  });

  test("somebody without a dashboard role touches nothing", async () => {
    allowed = false;
    const result = await setMarketingConsent("token", ID, true);
    expect(result.ok).toBe(false);
    expect(adminCalls).toBe(0);
    expect(rows[0].newsletter_subscribed).toBe(false);
    expect(resend).toEqual([]);
  });

  test("a malformed id or a non-boolean never reaches the database", async () => {
    for (const [id, enabled] of [
      ["not-a-uuid", true],
      ["", true],
      [ID, "yes" as unknown as boolean],
    ] as const) {
      expect(await setMarketingConsent("token", id, enabled)).toEqual({
        ok: false,
        error: "invalid",
      });
    }
    expect(adminCalls).toBe(0);
  });

  test("an unknown contact is notFound and the list is left alone", async () => {
    const result = await setMarketingConsent(
      "token",
      "22222222-2222-4222-8222-222222222222",
      true,
    );
    expect(result).toEqual({ ok: false, error: "notFound" });
    expect(resend).toEqual([]);
  });

  test("a database failure answers ok:false without its text and without touching the list", async () => {
    for (const failOn of ["read", "write"] as const) {
      dbFails = failOn;
      const result = await setMarketingConsent("token", ID, true);
      expect(result).toEqual({ ok: false, error: "db" });
      expect(JSON.stringify(result)).not.toContain("boom");
    }
    expect(resend).toEqual([]);
  });

  test("it leaves a trace of who did what, with no email or phone", async () => {
    const lines: unknown[][] = [];
    const real = console.info;
    console.info = (...args: unknown[]) => void lines.push(args);
    try {
      await setMarketingConsent("token", ID, true);
      await setMarketingConsent("token", ID, false);
    } finally {
      console.info = real;
    }
    expect(lines).toHaveLength(2);
    expect(lines[0][1]).toMatchObject({
      actor: "staff-1",
      contact: ID,
      use: "marketing",
      action: "on",
    });
    expect(lines[1][1]).toMatchObject({ action: "off" });
    const text = JSON.stringify(lines);
    expect(text).not.toContain("example.com");
    expect(text).not.toContain("ana@");
  });

  test("a change that did not happen leaves no trace", async () => {
    const lines: unknown[][] = [];
    const real = console.info;
    console.info = (...args: unknown[]) => void lines.push(args);
    try {
      dbFails = "read";
      await setMarketingConsent("token", ID, true);
      allowed = false;
      await setMarketingConsent("token", ID, true);
    } finally {
      console.info = real;
    }
    expect(lines).toEqual([]);
  });
});

describe("setWhatsAppConsent leaves the same trace", () => {
  test("the actor, the contact, the use and the direction, and nothing personal", async () => {
    const { setWhatsAppConsent } = await import("@/actions/contacts");
    const lines: unknown[][] = [];
    const real = console.info;
    console.info = (...args: unknown[]) => void lines.push(args);
    try {
      const result = await setWhatsAppConsent(
        "token",
        ID,
        "appointments",
        true,
      );
      expect(result.ok).toBe(true);
    } finally {
      console.info = real;
    }
    expect(lines).toHaveLength(1);
    expect(lines[0][1]).toMatchObject({
      actor: "staff-1",
      contact: ID,
      use: "appointments",
      action: "on",
    });
    expect(JSON.stringify(lines)).not.toContain("example.com");
  });
});
