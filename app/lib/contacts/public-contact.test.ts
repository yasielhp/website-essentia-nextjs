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
 * The contact of the public booking form, written by the server
 * (`savePublicContact`), run for real with the database and the request
 * replaced.
 *
 * What is under test: the form's input is a strict object, so no consent but
 * "news and offers" can be sent (never the booking-notice one); the member
 * check answers "member" or not and never the role, so an address of the
 * team reads like one with no account; nothing is written for a member; a
 * NEW contact is created with what was typed; an EXISTING one keeps its
 * name, phone and language and only gains the yes given, never over a STOP
 * or an unsubscribe; and the calls are rate limited per caller, never per
 * email (so a stranger cannot spend a client's turn).
 *
 * Modules are put back afterwards: `mock.module` is process-wide.
 */

type Rpc = { name: string; args: Record<string, unknown> };
let rpcs: Rpc[] = [];
let rows: Row[] = [];
let inserts: Row[] = [];
let roles: Record<string, string> = {};
let failing: "check_email_role" | "read" | "write" | null = null;

function database() {
  const { db, calls } = fakeDb(rows, {
    failOn: failing === "read" || failing === "write" ? failing : undefined,
  });
  inserts = calls.inserts;
  return Object.assign(db as object, {
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcs.push({ name, args });
      if (failing === name) return { data: null, error: { message: "boom" } };
      if (name === "check_email_role") {
        return { data: roles[String(args.p_email)] ?? null, error: null };
      }
      return { data: null, error: { message: `no function ${name}` } };
    },
  });
}

const real = {
  admin: { ...(await import("@/lib/insforge-admin")) },
  visitor: { ...(await import("@/lib/bookings/visitor")) },
  action: { ...(await import("@/actions/public-contact")) },
};

let core: typeof import("./public-contact");
let action: typeof import("@/actions/public-contact");

beforeAll(async () => {
  mock.module("@/lib/insforge-admin", () => ({
    ...real.admin,
    getAdminClient: () => ({ database: database() }),
  }));
  mock.module("@/lib/bookings/visitor", () => ({
    ...real.visitor,
    readVisitor: async () => ({ claims: null, ip: null }),
  }));
  // The real door, whatever another test file left registered.
  mock.module("@/actions/public-contact", () => real.action);
  core = await import("./public-contact");
  action = await import("@/actions/public-contact");
});

afterAll(() => {
  mock.module("@/lib/insforge-admin", () => real.admin);
  mock.module("@/lib/bookings/visitor", () => real.visitor);
});

/** A client already on file, with a number of her own. */
const onFile = (over: Row = {}): Row => ({
  id: "c-ana",
  email: "ana@example.com",
  first_name: "Ana María",
  last_name: "Pérez",
  phone: "+34611222333",
  preferred_language: "en",
  gender: "female",
  newsletter_subscribed: false,
  newsletter_unsubscribed_at: null,
  whatsapp_marketing_opted_in_at: null,
  whatsapp_opted_out_at: null,
  whatsapp_opted_in_at: null,
  updated_at: "2026-01-01T00:00:00.000Z",
  ...over,
});

beforeEach(() => {
  rpcs = [];
  rows = [];
  inserts = [];
  roles = {
    "member@example.com": "member",
    "admin@example.com": "admin",
    "staff@example.com": "staff",
  };
  failing = null;
});

/** Exactly what the details step sends. */
const input = (over: Record<string, unknown> = {}) => ({
  email: "ana@example.com",
  firstName: "Ana",
  lastName: "García",
  phone: "600000000",
  language: "es",
  gender: null,
  marketing: true,
  checkMember: true,
  ...over,
});

/** A fresh limit, so one test's calls do not count against another's. */
const run = (raw: unknown, ip: string | null = null) =>
  core.savePublicContactCore(raw, {
    visitor: { claims: null, ip },
    limiter: core.createContactLimiter(),
  });

describe("a new address: the contact is created with what was typed", () => {
  test("asked about once, then inserted with the service key, with the yes she gave", async () => {
    const answer = await action.savePublicContact(input());
    expect(answer).toEqual({ kind: "saved", contactId: "c1" });
    // The role is asked for and never answered: no `upsert_contact` at all.
    expect(rpcs).toEqual([
      { name: "check_email_role", args: { p_email: "ana@example.com" } },
    ]);
    expect(inserts).toEqual([
      expect.objectContaining({
        email: "ana@example.com",
        first_name: "Ana",
        last_name: "García",
        phone: "600000000",
        preferred_language: "es",
        gender: null,
        newsletter_subscribed: true,
      }),
    ]);
    expect(inserts[0]!.whatsapp_marketing_opted_in_at).not.toBeNull();
    // Never the booking-notice consent: that is `saveBookingConsents`'.
    expect(inserts[0]).not.toHaveProperty("whatsapp_opted_in_at");
  });

  test("'news and offers' unticked is no consent on either channel", async () => {
    await run(input({ marketing: null, gender: "female", language: "en" }));
    expect(inserts[0]).toMatchObject({
      newsletter_subscribed: false,
      newsletter_subscribed_at: null,
      whatsapp_marketing_opted_in_at: null,
      gender: "female",
      preferred_language: "en",
    });
  });

  test("an address written in capitals lands on the same, lowercased", async () => {
    rows = [onFile()];
    expect(await run(input({ email: "ANA@Example.com" }))).toEqual({
      kind: "saved",
      contactId: "c-ana",
    });
    expect(inserts).toEqual([]);
  });
});

describe("an address already on file: nothing of hers is changed", () => {
  test("her name, phone, language and gender stay; only the yes she gives is added", async () => {
    rows = [onFile()];
    expect(await run(input())).toEqual({ kind: "saved", contactId: "c-ana" });
    expect(inserts).toEqual([]);
    expect(rows[0]).toMatchObject({
      first_name: "Ana María",
      last_name: "Pérez",
      phone: "+34611222333",
      preferred_language: "en",
      gender: "female",
      newsletter_subscribed: true,
      // The booking-notice consent is never given here.
      whatsapp_opted_in_at: null,
    });
    expect(rows[0]!.whatsapp_marketing_opted_in_at).not.toBeNull();
    // Touched, so the notice consent that follows finds the row just written.
    expect(rows[0]!.updated_at).not.toBe("2026-01-01T00:00:00.000Z");
  });

  test("a STOP and an unsubscribe stay, ticked or not", async () => {
    rows = [
      onFile({
        whatsapp_opted_out_at: "2026-02-01T00:00:00.000Z",
        newsletter_unsubscribed_at: "2026-02-01T00:00:00.000Z",
      }),
    ];
    await run(input());
    expect(rows[0]).toMatchObject({
      whatsapp_opted_out_at: "2026-02-01T00:00:00.000Z",
      newsletter_unsubscribed_at: "2026-02-01T00:00:00.000Z",
      newsletter_subscribed: false,
      whatsapp_marketing_opted_in_at: null,
    });
  });

  test("a consent given before keeps its date", async () => {
    rows = [
      onFile({
        newsletter_subscribed: true,
        newsletter_subscribed_at: "2026-03-01T00:00:00.000Z",
        whatsapp_marketing_opted_in_at: "2026-03-01T00:00:00.000Z",
      }),
    ];
    await run(input());
    expect(rows[0]).toMatchObject({
      newsletter_subscribed_at: "2026-03-01T00:00:00.000Z",
      whatsapp_marketing_opted_in_at: "2026-03-01T00:00:00.000Z",
    });
  });
});

describe("the member check", () => {
  test("a member's address stops there: 'member', and nothing is read or written", async () => {
    expect(await run(input({ email: "member@example.com" }))).toEqual({
      kind: "member",
    });
    expect(rpcs.map((r) => r.name)).toEqual(["check_email_role"]);
    expect(inserts).toEqual([]);
  });

  test("an address of the team reads like one with no account: the role never leaves the server", async () => {
    for (const email of ["admin@example.com", "staff@example.com"]) {
      const answer = await run(input({ email }));
      expect(answer.kind).toBe("saved");
      expect(JSON.stringify(answer)).not.toMatch(/admin|staff|role/);
    }
  });

  test("not asked to check (signed in, or a member going on as a guest): no check, the contact is written", async () => {
    expect(
      (await run(input({ email: "member@example.com", checkMember: false })))
        .kind,
    ).toBe("saved");
    expect(rpcs).toEqual([]);
  });

  test("a check that fails goes on as for a guest", async () => {
    failing = "check_email_role";
    expect((await run(input())).kind).toBe("saved");
  });
});

describe("what is refused", () => {
  test.each([
    ["the booking-notice consent", { whatsapp: true }],
    ["a parameter of the function", { p_whatsapp: true }],
    ["marketing as false", { marketing: false }],
    ["an address that is not one", { email: "ana.example.com" }],
    ["a phone that is not one", { phone: "12" }],
    ["no first name", { firstName: " " }],
    ["a language the site does not have", { language: "fr" }],
    ["a gender the database does not store", { gender: "x" }],
    ["no member check stated", { checkMember: undefined }],
  ])("%s is refused, and nothing is read or written", async (_what, over) => {
    expect(await run(input(over))).toEqual({ kind: "invalid" });
    expect(rpcs).toEqual([]);
    expect(inserts).toEqual([]);
  });

  test("a database that does not answer is 'failed'", async () => {
    failing = "read";
    expect(await run(input())).toEqual({ kind: "failed" });
    failing = "write";
    expect(await run(input())).toEqual({ kind: "failed" });
  });
});

describe("the rate limit: per caller, never per email", () => {
  test("one caller: many addresses from one place are stopped, before any is asked about", async () => {
    const limiter = core.createContactLimiter();
    const from = (n: number, ip = "203.0.113.9") =>
      core.savePublicContactCore(input({ email: `p${n}@example.com` }), {
        visitor: { claims: null, ip },
        limiter,
      });
    for (let n = 0; n < core.PUBLIC_CONTACT_LIMIT_PER_IP; n++) {
      expect((await from(n)).kind).toBe("saved");
    }
    rpcs = [];
    expect(await from(999)).toEqual({ kind: "rate_limited" });
    expect(rpcs).toEqual([]);
    // Somebody else is not held back by it.
    expect((await from(1000, "198.51.100.1")).kind).toBe("saved");
  });

  test("a stranger who spends her own turn on a client's address does not spend the client's", async () => {
    const limiter = core.createContactLimiter();
    const call = (ip: string) =>
      core.savePublicContactCore(input(), {
        visitor: { claims: null, ip },
        limiter,
      });
    for (let n = 0; n < core.PUBLIC_CONTACT_LIMIT_PER_IP; n++) {
      await call("203.0.113.66");
    }
    expect((await call("203.0.113.66")).kind).toBe("rate_limited");
    // The client herself, from her own connection, books as usual.
    expect((await call("198.51.100.20")).kind).toBe("saved");
  });
});
