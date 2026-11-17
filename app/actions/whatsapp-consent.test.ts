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
 * The booking form's one consent action, run for real with its session check,
 * its database and the newsletter list replaced. What is under test is WHOSE
 * contact it writes and stamps (the session's, or the guest's), that it needs
 * the terms, that it never throws or leaks the database's text, and that a
 * database that hangs gets an answer anyway. The stamping rules themselves are
 * in `self-consent.test.ts`, the order and the deadline in
 * `booking-consents.test.ts`.
 *
 * Modules are put back afterwards: `mock.module` is process-wide.
 */

let rows: Row[] = [];
let sessionEmail: string | null = "session@example.com";
let sessionValid = true;
let dbFails = false;
let dbHangs = false;
let adminCalls = 0;
let rpcCalls: { name: string; args: unknown }[] = [];
let listed: string[] = [];

const real = {
  admin: { ...(await import("@/lib/insforge-admin")) },
  guard: { ...(await import("@/lib/auth-guard")) },
  newsletter: { ...(await import("@/lib/newsletter")) },
};

let saveBookingConsents: typeof import("@/actions/whatsapp-consent").saveBookingConsents;

beforeAll(async () => {
  mock.module("@/lib/insforge-admin", () => ({
    ...real.admin,
    getAdminClient: () => {
      adminCalls += 1;
      if (dbHangs) {
        const hung = {
          from: () => hung,
          select: () => hung,
          eq: () => hung,
          limit: () => new Promise(() => undefined),
        };
        return { database: hung };
      }
      const { db, calls } = fakeDb(rows, {
        failOn: dbFails ? "read" : undefined,
      });
      rpcCalls = calls.rpc;
      return { database: db };
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
  mock.module("@/lib/newsletter", () => ({
    ...real.newsletter,
    setNewsletterState: async (email: string) => {
      listed.push(email);
      return { ok: true };
    },
  }));
  ({ saveBookingConsents } = await import("@/actions/whatsapp-consent"));
});

afterAll(() => {
  mock.module("@/lib/insforge-admin", () => real.admin);
  mock.module("@/lib/auth-guard", () => real.guard);
  mock.module("@/lib/newsletter", () => real.newsletter);
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
  dbHangs = false;
  adminCalls = 0;
  rpcCalls = [];
  listed = [];
});

const input = (over: Record<string, unknown> = {}) => ({
  email: "guest@example.com",
  firstName: "Ana",
  lastName: "García",
  phone: "600000000",
  language: "es",
  marketing: false,
  termsAccepted: true,
  ...over,
});

describe("saveBookingConsents", () => {
  test("a guest who accepted the terms is stamped on the address of the step", async () => {
    const result = await saveBookingConsents(
      null,
      input({ email: " Guest@Example.com " }),
    );
    expect(result).toEqual({ ok: true, stamped: true });
    expect(rows[0].whatsapp_opted_in_at).not.toBeNull();
    expect(rows[1].whatsapp_opted_in_at).toBeNull();
    // A guest's contact is the browser's `upsert_contact`, not this action's.
    expect(rpcCalls).toEqual([]);
  });

  test("a signed-in client's contact is written and stamped on her session's address, whatever the browser sent", async () => {
    const result = await saveBookingConsents("token", input());
    expect(result).toEqual({ ok: true, stamped: true });
    expect(rows[1].whatsapp_opted_in_at).not.toBeNull();
    expect(rows[0].whatsapp_opted_in_at).toBeNull();
  });

  test("her news and offers tick puts her session's address on the list", async () => {
    const result = await saveBookingConsents(
      "token",
      input({ email: "session@example.com", marketing: true }),
    );
    expect(result).toEqual({ ok: true, stamped: true });
    expect(listed).toEqual(["session@example.com"]);
  });

  test("nothing is stamped without the terms accepted", async () => {
    for (const body of [
      {},
      { email: "guest@example.com" },
      input({ termsAccepted: false }),
      input({ termsAccepted: "true" }),
      null,
    ]) {
      await saveBookingConsents(null, body);
    }
    expect(rows.every((r) => r.whatsapp_opted_in_at === null)).toBe(true);
    expect(adminCalls).toBe(0);
  });

  test("a token that does not verify never falls back to the guest's address", async () => {
    sessionValid = false;
    const result = await saveBookingConsents("stale", input());
    expect(result).toEqual({ ok: false, stamped: false, error: "auth" });
    expect(rows[0].whatsapp_opted_in_at).toBeNull();
    expect(adminCalls).toBe(0);
  });

  test("a session with no address stamps nobody", async () => {
    sessionEmail = null;
    const result = await saveBookingConsents("token", input());
    expect(result).toEqual({ ok: false, stamped: false, error: "noEmail" });
    expect(rows.every((r) => r.whatsapp_opted_in_at === null)).toBe(true);
  });

  test("a guest who sent a STOP is not reactivated by booking again", async () => {
    rows[0].whatsapp_opted_out_at = "2026-01-01T00:00:00.000Z";
    const result = await saveBookingConsents(null, input());
    expect(result).toEqual({ ok: true, stamped: false });
    expect(rows[0].whatsapp_opted_in_at).toBeNull();
    expect(rows[0].whatsapp_opted_out_at).toBe("2026-01-01T00:00:00.000Z");
  });

  test("an address typed for a contact that was not just saved is not stamped", async () => {
    rows[0].updated_at = "2026-01-01T00:00:00.000Z";
    rows[0].created_at = "2026-01-01T00:00:00.000Z";
    const result = await saveBookingConsents(null, input());
    expect(result).toEqual({ ok: true, stamped: false });
    expect(rows[0].whatsapp_opted_in_at).toBeNull();
  });

  test("a database failure answers ok:false, quietly and without its text", async () => {
    dbFails = true;
    const result = await saveBookingConsents(null, input());
    expect(result).toEqual({ ok: false, stamped: false, error: "db" });
    expect(JSON.stringify(result)).not.toContain("boom");
  });

  // The one test that waits for the real deadline: it is what proves the
  // action itself, as the page calls it, lets go of a database that hangs.
  test("a database that never answers is given up on at the deadline, without throwing", async () => {
    dbHangs = true;
    const errors = console.error;
    const logged: unknown[][] = [];
    console.error = (...args: unknown[]) => void logged.push(args);
    try {
      const startedAt = Date.now();
      const result = await saveBookingConsents(null, input());
      const took = Date.now() - startedAt;
      expect(result).toEqual({ ok: false, stamped: false, error: "timeout" });
      expect(took).toBeGreaterThanOrEqual(2900);
      expect(took).toBeLessThan(4000);
      expect(logged).toHaveLength(1);
      expect(JSON.stringify(logged)).not.toContain("guest@example.com");
    } finally {
      console.error = errors;
    }
  });
});
