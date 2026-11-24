import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";

/**
 * The contact of the public booking form, written by the server
 * (`savePublicContact`), run for real with the database and the request
 * replaced.
 *
 * What is under test: the form's input is a strict object, so no consent but
 * "news and offers" can be sent (never the booking-notice one); the member
 * check answers "member" or not and never the role, so an address of the
 * team reads like one with no account; nothing is written for a member; the
 * contact goes through `upsert_contact` with the service key exactly as the
 * browser used to send it; and the calls are rate limited per caller and per
 * email.
 *
 * Modules are put back afterwards: `mock.module` is process-wide.
 */

type Rpc = { name: string; args: Record<string, unknown> };
let rpcs: Rpc[] = [];
let roles: Record<string, string> = {};
let failing: string | null = null;

const db = {
  rpc: async (name: string, args: Record<string, unknown>) => {
    rpcs.push({ name, args });
    if (failing === name) return { data: null, error: { message: "boom" } };
    if (name === "check_email_role") {
      return { data: roles[String(args.p_email)] ?? null, error: null };
    }
    if (name === "upsert_contact") return { data: "contact-1", error: null };
    return { data: null, error: { message: `no function ${name}` } };
  },
  from: () => {
    throw new Error("no table is read or written directly");
  },
};

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
    getAdminClient: () => ({ database: db }),
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

beforeEach(() => {
  rpcs = [];
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

/** Fresh limits, so one test's calls do not count against another's. */
const run = (raw: unknown, ip: string | null = null) =>
  core.savePublicContactCore(raw, {
    visitor: { claims: null, ip },
    limiters: core.createContactLimiters(),
  });

describe("the contact of the booking form, written by the server", () => {
  test("a guest: asked about once, then written with the service key as the form sent it", async () => {
    expect(await action.savePublicContact(input())).toEqual({
      kind: "saved",
      contactId: "contact-1",
    });
    expect(rpcs).toEqual([
      { name: "check_email_role", args: { p_email: "ana@example.com" } },
      {
        name: "upsert_contact",
        args: {
          p_email: "ana@example.com",
          p_first_name: "Ana",
          p_last_name: "García",
          p_phone: "600000000",
          p_language: "es",
          p_gender: null,
          // One box, both channels.
          p_newsletter: true,
          // The booking notices are `saveBookingConsents`' to stamp.
          p_whatsapp: null,
          p_whatsapp_marketing: true,
        },
      },
    ]);
  });

  test("'news and offers' unticked is null for both channels: it touches nothing", async () => {
    await run(input({ marketing: null, gender: "female", language: "en" }));
    expect(rpcs.at(-1)?.args).toMatchObject({
      p_newsletter: null,
      p_whatsapp: null,
      p_whatsapp_marketing: null,
      p_gender: "female",
      p_language: "en",
    });
  });

  test("a member's address stops there: 'member', and nothing is written", async () => {
    expect(await run(input({ email: "member@example.com" }))).toEqual({
      kind: "member",
    });
    expect(rpcs.map((r) => r.name)).toEqual(["check_email_role"]);
  });

  test("an address of the team reads like one with no account: the role never leaves the server", async () => {
    for (const email of ["admin@example.com", "staff@example.com"]) {
      rpcs = [];
      const answer = await run(input({ email }));
      expect(answer).toEqual({ kind: "saved", contactId: "contact-1" });
      expect(JSON.stringify(answer)).not.toMatch(/admin|staff|role/);
    }
  });

  test("not asked to check (signed in, or a member going on as a guest): no check, the contact is written", async () => {
    expect(
      await run(input({ email: "member@example.com", checkMember: false })),
    ).toEqual({ kind: "saved", contactId: "contact-1" });
    expect(rpcs.map((r) => r.name)).toEqual(["upsert_contact"]);
  });

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
  });

  test("a check that fails goes on as for a guest; a write that fails is 'failed'", async () => {
    failing = "check_email_role";
    expect(await run(input())).toEqual({
      kind: "saved",
      contactId: "contact-1",
    });
    failing = "upsert_contact";
    expect(await run(input())).toEqual({ kind: "failed" });
  });
});

describe("the rate limits", () => {
  test("one email: a few calls in ten minutes, then 'rate_limited' with nothing asked or written", async () => {
    const limiters = core.createContactLimiters();
    const call = () =>
      core.savePublicContactCore(input({ email: "Ana@Example.com" }), {
        visitor: { claims: null, ip: null },
        limiters,
      });
    for (let i = 0; i < core.PUBLIC_CONTACT_LIMITS.perEmail; i++) {
      expect((await call()).kind).toBe("saved");
    }
    rpcs = [];
    // The same address, whatever its case.
    expect(
      await core.savePublicContactCore(input({ email: "ana@example.com" }), {
        visitor: { claims: null, ip: null },
        limiters,
      }),
    ).toEqual({ kind: "rate_limited" });
    expect(rpcs).toEqual([]);
  });

  test("one caller: many addresses from one place are stopped too, before any is asked about", async () => {
    const limiters = core.createContactLimiters();
    const from = (n: number) =>
      core.savePublicContactCore(input({ email: `p${n}@example.com` }), {
        visitor: { claims: null, ip: "203.0.113.9" },
        limiters,
      });
    for (let n = 0; n < core.PUBLIC_CONTACT_LIMITS.perIp; n++) {
      expect((await from(n)).kind).toBe("saved");
    }
    rpcs = [];
    expect(await from(999)).toEqual({ kind: "rate_limited" });
    expect(rpcs).toEqual([]);
    // Somebody else is not held back by it.
    expect(
      (
        await core.savePublicContactCore(input(), {
          visitor: { claims: null, ip: "198.51.100.1" },
          limiters,
        })
      ).kind,
    ).toBe("saved");
  });
});
