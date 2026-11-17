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
 * The booking-notice consent action, run for real with its session check and
 * its database replaced. What is under test is WHOSE address it stamps (the
 * session's, or the guest's), that it needs the terms, and that it never
 * throws or leaks the database's text. The stamping rules themselves are in
 * `self-consent.test.ts`.
 *
 * Modules are put back afterwards: `mock.module` is process-wide.
 */

let rows: Row[] = [];
let sessionEmail: string | null = "session@example.com";
let sessionValid = true;
let dbFails = false;
let adminCalls = 0;

const real = {
  admin: { ...(await import("@/lib/insforge-admin")) },
  guard: { ...(await import("@/lib/auth-guard")) },
};

let recordBookingNoticeConsent: typeof import("@/actions/whatsapp-consent").recordBookingNoticeConsent;

beforeAll(async () => {
  mock.module("@/lib/insforge-admin", () => ({
    ...real.admin,
    getAdminClient: () => {
      adminCalls += 1;
      return {
        database: fakeDb(rows, { failOn: dbFails ? "read" : undefined }).db,
      };
    },
  }));
  mock.module("@/lib/auth-guard", () => ({
    ...real.guard,
    authenticate: async () => {
      if (!sessionValid)
        throw new real.guard.AuthError("Invalid or expired session", 401);
      return { userId: "u1", email: sessionEmail, role: "member" };
    },
  }));
  ({ recordBookingNoticeConsent } = await import("@/actions/whatsapp-consent"));
});

afterAll(() => {
  mock.module("@/lib/insforge-admin", () => real.admin);
  mock.module("@/lib/auth-guard", () => real.guard);
});

const now = () => new Date().toISOString();
const contact = (email: string, over: Row = {}): Row => ({
  id: email,
  email,
  created_at: now(),
  updated_at: now(),
  whatsapp_opted_in_at: null,
  whatsapp_opted_out_at: null,
  ...over,
});

beforeEach(() => {
  rows = [contact("guest@example.com"), contact("session@example.com")];
  sessionEmail = "session@example.com";
  sessionValid = true;
  dbFails = false;
  adminCalls = 0;
});

describe("recordBookingNoticeConsent", () => {
  test("a guest who accepted the terms is stamped on the address of the step", async () => {
    const result = await recordBookingNoticeConsent(null, {
      termsAccepted: true,
      email: " Guest@Example.com ",
    });
    expect(result).toEqual({ ok: true, stamped: true });
    expect(rows[0].whatsapp_opted_in_at).not.toBeNull();
    expect(rows[1].whatsapp_opted_in_at).toBeNull();
  });

  test("a signed-in client is stamped on her session's address, whatever the browser sent", async () => {
    const result = await recordBookingNoticeConsent("token", {
      termsAccepted: true,
      email: "guest@example.com",
    });
    expect(result).toEqual({ ok: true, stamped: true });
    expect(rows[1].whatsapp_opted_in_at).not.toBeNull();
    expect(rows[0].whatsapp_opted_in_at).toBeNull();
  });

  test("nothing is stamped without the terms accepted", async () => {
    for (const input of [
      {},
      { email: "guest@example.com" },
      { termsAccepted: false, email: "guest@example.com" },
      { termsAccepted: "true", email: "guest@example.com" },
      null,
    ]) {
      const result = await recordBookingNoticeConsent(null, input);
      expect(result.ok).toBe(false);
    }
    expect(rows.every((r) => r.whatsapp_opted_in_at === null)).toBe(true);
    expect(adminCalls).toBe(0);
  });

  test("a token that does not verify never falls back to the guest's address", async () => {
    sessionValid = false;
    const result = await recordBookingNoticeConsent("stale", {
      termsAccepted: true,
      email: "guest@example.com",
    });
    expect(result).toEqual({ ok: false, error: "auth" });
    expect(rows[0].whatsapp_opted_in_at).toBeNull();
  });

  test("a session with no address stamps nobody", async () => {
    sessionEmail = null;
    const result = await recordBookingNoticeConsent("token", {
      termsAccepted: true,
      email: "guest@example.com",
    });
    expect(result).toEqual({ ok: false, error: "noEmail" });
    expect(rows.every((r) => r.whatsapp_opted_in_at === null)).toBe(true);
  });

  test("a guest who sent a STOP is not reactivated by booking again", async () => {
    rows[0].whatsapp_opted_out_at = "2026-01-01T00:00:00.000Z";
    const result = await recordBookingNoticeConsent(null, {
      termsAccepted: true,
      email: "guest@example.com",
    });
    expect(result).toEqual({ ok: true, stamped: false });
    expect(rows[0].whatsapp_opted_in_at).toBeNull();
    expect(rows[0].whatsapp_opted_out_at).toBe("2026-01-01T00:00:00.000Z");
  });

  test("an address typed for a contact that was not just saved is not stamped", async () => {
    rows[0].updated_at = "2026-01-01T00:00:00.000Z";
    rows[0].created_at = "2026-01-01T00:00:00.000Z";
    const result = await recordBookingNoticeConsent(null, {
      termsAccepted: true,
      email: "guest@example.com",
    });
    expect(result).toEqual({ ok: true, stamped: false });
    expect(rows[0].whatsapp_opted_in_at).toBeNull();
  });

  test("a database failure answers ok:false, quietly and without its text", async () => {
    dbFails = true;
    const result = await recordBookingNoticeConsent(null, {
      termsAccepted: true,
      email: "guest@example.com",
    });
    expect(result).toEqual({ ok: false, error: "db" });
    expect(JSON.stringify(result)).not.toContain("boom");
  });
});
