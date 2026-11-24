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
let profileEmail: string | null = "session@example.com";
let callerIp: string | null = null;
let sessionValid = true;
let dbFails = false;
let dbHangs = false;
let adminCalls = 0;
/** One list per client the action asked for; `rpcs()` reads them all. */
let rpcLists: { name: string; args: unknown }[][] = [];
const rpcs = () => rpcLists.flat();
/** The contact rows it inserted, and the patches it wrote, the same way. */
let writeLists: Row[][] = [];
const writes = () => writeLists.flat();
let listed: string[] = [];

const real = {
  admin: { ...(await import("@/lib/insforge-admin")) },
  guard: { ...(await import("@/lib/auth-guard")) },
  newsletter: { ...(await import("@/lib/newsletter")) },
  security: { ...(await import("@/lib/auth-security")) },
};

let saveBookingConsents: typeof import("@/actions/whatsapp-consent").saveBookingConsents;
let saveBookingConsentsCore: typeof import("@/lib/whatsapp/save-booking-consents").saveBookingConsentsCore;
let fetchOwnMarketingOn: typeof import("@/actions/whatsapp-consent").fetchOwnMarketingOn;

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
      rpcLists.push(calls.rpc);
      writeLists.push(calls.inserts);
      return { database: db };
    },
  }));
  mock.module("@/lib/auth-guard", () => ({
    ...real.guard,
    authenticate: async (token: string | null) => {
      if (!token)
        throw new real.guard.AuthError("Authentication required", 401);
      if (!sessionValid)
        throw new real.guard.AuthError("Invalid or expired session", 401);
      // `email` is the profile's, which she can rewrite; `verifiedEmail` is
      // the auth session's. Only the second may decide whose contact it is.
      return {
        userId: "u1",
        email: profileEmail,
        verifiedEmail: sessionEmail,
        role: "member",
      };
    },
  }));
  mock.module("@/lib/newsletter", () => ({
    ...real.newsletter,
    // The list, as the real one decides it: never over an unsubscribe.
    subscribeUnlessUnsubscribed: async (email: string) => {
      const row = rows.find((r) => r.email === email);
      if (row?.newsletter_unsubscribed_at) return { ok: true, skipped: true };
      listed.push(email);
      return { ok: true };
    },
  }));
  mock.module("@/lib/auth-security", () => ({
    ...real.security,
    clientIp: async () => callerIp,
  }));
  ({ saveBookingConsents, fetchOwnMarketingOn } =
    await import("@/actions/whatsapp-consent"));
  ({ saveBookingConsentsCore } =
    await import("@/lib/whatsapp/save-booking-consents"));
});

afterAll(() => {
  mock.module("@/lib/insforge-admin", () => real.admin);
  mock.module("@/lib/auth-guard", () => real.guard);
  mock.module("@/lib/newsletter", () => real.newsletter);
  mock.module("@/lib/auth-security", () => real.security);
});

const now = () => new Date().toISOString();
const contact = (email: string, over: Row = {}): Row => ({
  id: email,
  email,
  first_name: "On file",
  phone: "+34600000000",
  preferred_language: "en",
  created_at: now(),
  updated_at: now(),
  whatsapp_opted_in_at: null,
  whatsapp_opted_out_at: null,
  ...over,
});

beforeEach(() => {
  rows = [contact("guest@example.com"), contact("session@example.com")];
  sessionEmail = "session@example.com";
  profileEmail = "session@example.com";
  callerIp = null;
  sessionValid = true;
  dbFails = false;
  dbHangs = false;
  adminCalls = 0;
  rpcLists = [];
  writeLists = [];
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
    expect(result).toEqual({ ok: true });
    expect(rows[0].whatsapp_opted_in_at).not.toBeNull();
    expect(rows[1].whatsapp_opted_in_at).toBeNull();
    // A guest's contact is the contact action's (`savePublicContact`), not
    // this one's.
    expect(rpcs()).toEqual([]);
  });

  test("a signed-in client booking with her own address has her contact written the public way, and stamped", async () => {
    const result = await saveBookingConsents(
      "token",
      input({ email: " Session@Example.com", marketing: true }),
    );
    expect(result).toEqual({ ok: true });
    // Her contact exists: no `upsert_contact`, nothing inserted, and what is
    // on file stays; only the yes she gave is added.
    expect(rpcs()).toEqual([]);
    expect(writes()).toEqual([]);
    expect(rows[1]).toMatchObject({
      first_name: "On file",
      phone: "+34600000000",
      preferred_language: "en",
      newsletter_subscribed: true,
    });
    expect(rows[1].whatsapp_marketing_opted_in_at).not.toBeNull();
    expect(rows[1].whatsapp_opted_in_at).not.toBeNull();
    expect(rows[0].whatsapp_opted_in_at).toBeNull();
    expect(listed).toEqual(["session@example.com"]);
  });

  test("a signed-in client with no contact yet has one created with what she typed", async () => {
    rows = [contact("guest@example.com")];
    const result = await saveBookingConsents(
      "token",
      input({ email: "session@example.com" }),
    );
    expect(result).toEqual({ ok: true });
    expect(writes()).toEqual([
      expect.objectContaining({
        email: "session@example.com",
        first_name: "Ana",
        phone: "600000000",
        preferred_language: "es",
      }),
    ]);
    // Her number is the one she typed, so the notices are hers.
    expect(rows[1]?.whatsapp_opted_in_at).not.toBeNull();
  });

  test("with ANOTHER phone typed than her contact's, her contact keeps its number and gets no notice consent", async () => {
    const result = await saveBookingConsents(
      "token",
      input({ email: "session@example.com", phone: "611 222 333" }),
    );
    expect(result).toEqual({ ok: true });
    expect(rows[1].phone).toBe("+34600000000");
    expect(rows[1].whatsapp_opted_in_at).toBeNull();
  });

  test("a guest with ANOTHER phone than the contact of the address gets no notice consent on it", async () => {
    const result = await saveBookingConsents(
      null,
      input({ phone: "+44 7700 900123" }),
    );
    expect(result).toEqual({ ok: true });
    expect(rows[0].whatsapp_opted_in_at).toBeNull();
  });

  test("a STOP or an unsubscribe of hers is not taken back by the box", async () => {
    rows[1].whatsapp_opted_out_at = "2026-01-01T00:00:00.000Z";
    rows[1].newsletter_unsubscribed_at = "2026-01-01T00:00:00.000Z";
    const result = await saveBookingConsents(
      "token",
      input({ email: "session@example.com", marketing: true }),
    );
    expect(result).toEqual({ ok: true });
    expect(rows[1]).toMatchObject({
      whatsapp_opted_out_at: "2026-01-01T00:00:00.000Z",
      newsletter_unsubscribed_at: "2026-01-01T00:00:00.000Z",
      whatsapp_opted_in_at: null,
    });
    expect(rows[1].newsletter_subscribed ?? null).toBeNull();
    expect(listed).toEqual([]);
  });

  test("signed in with ANOTHER address in the form: the session's contact is not written, stamped or listed", async () => {
    const result = await saveBookingConsents(
      "token",
      input({ email: "guest@example.com", marketing: true }),
    );
    expect(result).toEqual({ ok: true });
    // No name or phone of somebody else lands on the caller's own contact.
    expect(rpcs()).toEqual([]);
    expect(listed).toEqual([]);
    expect(rows[1].whatsapp_opted_in_at).toBeNull();
    // That booking's consent goes the guest's way: the form's contact, which
    // the step has just written.
    expect(rows[0].whatsapp_opted_in_at).not.toBeNull();
  });

  test("and the guest's guards hold for it: a contact not just written, or with a STOP, is not stamped", async () => {
    rows[0].updated_at = "2026-01-01T00:00:00.000Z";
    rows[0].created_at = "2026-01-01T00:00:00.000Z";
    expect(await saveBookingConsents("token", input())).toEqual({ ok: true });
    rows[0] = contact("guest@example.com", {
      whatsapp_opted_out_at: "2026-01-01T00:00:00.000Z",
    });
    expect(await saveBookingConsents("token", input())).toEqual({ ok: true });
    expect(rows[0].whatsapp_opted_in_at).toBeNull();
    expect(rows[1].whatsapp_opted_in_at).toBeNull();
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
    expect(result).toEqual({ ok: false, error: "auth" });
    expect(rows[0].whatsapp_opted_in_at).toBeNull();
    expect(adminCalls).toBe(0);
  });

  test("a session with no address has no contact of its own: the form's goes the guest's way", async () => {
    sessionEmail = null;
    const result = await saveBookingConsents("token", input());
    expect(result).toEqual({ ok: true });
    expect(rpcs()).toEqual([]);
    expect(rows[0].whatsapp_opted_in_at).not.toBeNull();
    expect(rows[1].whatsapp_opted_in_at).toBeNull();
  });

  test("a guest who sent a STOP is not reactivated by booking again", async () => {
    rows[0].whatsapp_opted_out_at = "2026-01-01T00:00:00.000Z";
    const result = await saveBookingConsents(null, input());
    expect(result).toEqual({ ok: true });
    expect(rows[0].whatsapp_opted_in_at).toBeNull();
    expect(rows[0].whatsapp_opted_out_at).toBe("2026-01-01T00:00:00.000Z");
  });

  test("an address typed for a contact that was not just saved is not stamped", async () => {
    rows[0].updated_at = "2026-01-01T00:00:00.000Z";
    rows[0].created_at = "2026-01-01T00:00:00.000Z";
    const result = await saveBookingConsents(null, input());
    expect(result).toEqual({ ok: true });
    expect(rows[0].whatsapp_opted_in_at).toBeNull();
  });

  test("a database failure answers ok:false, quietly and without its text", async () => {
    dbFails = true;
    const result = await saveBookingConsents(null, input());
    expect(result).toEqual({ ok: false, error: "db" });
    expect(JSON.stringify(result)).not.toContain("boom");
  });

  test("the answer never says whether a consent was stamped: a fresh contact, no contact and a STOP read the same", async () => {
    const fresh = await saveBookingConsents(null, input());
    const none = await saveBookingConsents(
      null,
      input({ email: "nobody@example.com" }),
    );
    rows[1].whatsapp_opted_out_at = "2026-01-01T00:00:00.000Z";
    const stopped = await saveBookingConsents(
      null,
      input({ email: "session@example.com" }),
    );
    expect(rows[0].whatsapp_opted_in_at).not.toBeNull();
    expect(none).toEqual(fresh);
    expect(stopped).toEqual(fresh);
    expect(Object.keys(fresh)).toEqual(["ok"]);
  });

  test("a profile address she rewrote to somebody else's does not make that contact her own", async () => {
    // She signed in as session@, then set her profile's address to guest@.
    profileEmail = "guest@example.com";
    rows[0].created_at = "2026-01-01T00:00:00.000Z";
    rows[0].updated_at = "2026-01-01T00:00:00.000Z";
    const result = await saveBookingConsents(
      "token",
      input({ email: "guest@example.com", marketing: true }),
    );
    expect(result).toEqual({ ok: true });
    // Not her own contact: nothing is written on it in her name, and the
    // guest's guards (a contact just written) keep it unstamped.
    expect(rpcs()).toEqual([]);
    expect(listed).toEqual([]);
    expect(rows[0].whatsapp_opted_in_at).toBeNull();
  });

  test("her own contact is the one of the address she signed in with, whatever her profile says", async () => {
    profileEmail = "guest@example.com";
    const result = await saveBookingConsents(
      "token",
      input({ email: "session@example.com" }),
    );
    expect(result).toEqual({ ok: true });
    // The session's contact is the one stamped, not the profile's.
    expect(rows[1].whatsapp_opted_in_at).not.toBeNull();
    expect(rows[0].whatsapp_opted_in_at).toBeNull();
  });

  test("one address is slowed down after 30 calls in the window, with nothing read for the rest", async () => {
    callerIp = "203.0.113.7";
    for (let i = 0; i < 30; i += 1) {
      expect(await saveBookingConsents(null, input())).toEqual({ ok: true });
    }
    adminCalls = 0;
    expect(await saveBookingConsents(null, input())).toEqual({
      ok: false,
      error: "rate_limited",
    });
    expect(adminCalls).toBe(0);
    // Another address, and a caller with none, are not held back by it.
    callerIp = "203.0.113.8";
    expect(await saveBookingConsents(null, input())).toEqual({ ok: true });
    callerIp = null;
    expect(await saveBookingConsents(null, input())).toEqual({ ok: true });
  });

  // What the action runs, with the deadline shortened: the deadline is a
  // parameter of the core and not of the action (whose arguments come from the
  // browser), so nothing here waits three real seconds.
  test("a database that never answers is given up on at the deadline, without throwing", async () => {
    dbHangs = true;
    const errors = console.error;
    const logged: unknown[][] = [];
    console.error = (...args: unknown[]) => void logged.push(args);
    try {
      const startedAt = Date.now();
      const result = await saveBookingConsentsCore(null, input(), {
        deadlineMs: 40,
      });
      const took = Date.now() - startedAt;
      expect(result).toEqual({ ok: false, error: "timeout" });
      expect(took).toBeGreaterThanOrEqual(30);
      expect(took).toBeLessThan(1000);
      expect(logged).toHaveLength(1);
      expect(JSON.stringify(logged)).not.toContain("guest@example.com");
    } finally {
      console.error = errors;
    }
  });

  test("the action is that same core with the three-second deadline and no way to change it", async () => {
    expect(saveBookingConsents.length).toBe(2);
    expect(await saveBookingConsents(null, input())).toEqual(
      await saveBookingConsentsCore(null, input()),
    );
  });
});

describe("fetchOwnMarketingOn", () => {
  const marketingOn = {
    newsletter_subscribed: true,
    newsletter_unsubscribed_at: null,
    whatsapp_marketing_opted_in_at: "2026-11-01T10:00:00.000Z",
  };

  test("answers for the contact of the address she signed in with", async () => {
    rows[1] = contact("session@example.com", marketingOn);
    expect(await fetchOwnMarketingOn("token")).toBe(true);
    rows[1] = contact("session@example.com");
    expect(await fetchOwnMarketingOn("token")).toBe(false);
  });

  test("a profile address she rewrote to somebody else's does not make it answer for that person", async () => {
    // guest@ has news and offers on; she, signed in as session@, does not.
    rows[0] = contact("guest@example.com", marketingOn);
    profileEmail = "guest@example.com";
    expect(await fetchOwnMarketingOn("token")).toBe(false);
    // And her own answer does not depend on what the profile says either.
    rows[1] = contact("session@example.com", marketingOn);
    profileEmail = "nobody@example.com";
    expect(await fetchOwnMarketingOn("token")).toBe(true);
  });

  test("no token, a token that does not verify or a session with no address is 'not on', never an error", async () => {
    rows[1] = contact("session@example.com", marketingOn);
    expect(await fetchOwnMarketingOn(null)).toBe(false);
    sessionValid = false;
    expect(await fetchOwnMarketingOn("stale")).toBe(false);
    sessionValid = true;
    sessionEmail = null;
    expect(await fetchOwnMarketingOn("token")).toBe(false);
  });

  test("a database that fails is 'not on'", async () => {
    rows[1] = contact("session@example.com", marketingOn);
    dbFails = true;
    expect(await fetchOwnMarketingOn("token")).toBe(false);
  });
});
