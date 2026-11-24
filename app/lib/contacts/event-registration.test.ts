import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import { chainDb, filters } from "@/lib/campaigns/fake-db";

/**
 * The registrations of the Running Club and the education programmes,
 * written by the server, run for real through their actions
 * (`app/actions/event-registration.ts`) with the database, the session check
 * and the request replaced.
 *
 * What is under test: a guest is registered by her own contact, only for an
 * event that exists, and an address that is a member's is told "member" and
 * nothing else, with nothing written; a signed-in person registers HERSELF,
 * the account her token proves, and only the team may name another account;
 * the input is a strict object (no contact or account id can be slipped in);
 * and nobody is registered without a session that checks out.
 *
 * Modules are put back afterwards: `mock.module` is process-wide.
 */

const RACE = "11111111-1111-4111-8111-111111111111";
const SESSION = "22222222-2222-4222-8222-222222222222";
const MISSING = "33333333-3333-4333-8333-333333333333";
const CLIENT = "44444444-4444-4444-8444-444444444444";
const SOMEONE = "55555555-5555-4555-8555-555555555555";

type Rpc = { name: string; args: Record<string, unknown> };
let rpcs: Rpc[] = [];
let reads: string[] = [];
let failing: string | null = null;

const tables: Record<string, { id: string }[]> = {
  races: [{ id: RACE }],
  education_sessions: [{ id: SESSION }],
};
const roles: Record<string, string> = {
  "member@example.com": "member",
  "admin@example.com": "admin",
};

const { db } = chainDb((table, chain) => {
  reads.push(table);
  if (failing === table) return { data: null, error: { message: "boom" } };
  const id = filters(chain).id;
  return {
    data: (tables[table] ?? []).find((row) => row.id === id) ?? null,
    error: null,
  };
});
Object.assign(db, {
  rpc: async (name: string, args: Record<string, unknown>) => {
    rpcs.push({ name, args });
    if (failing === name) return { data: null, error: { message: "boom" } };
    if (name === "check_email_role") {
      return { data: roles[String(args.p_email)] ?? null, error: null };
    }
    if (name === "upsert_contact") return { data: "contact-1", error: null };
    return { data: null, error: null };
  },
});

const real = {
  admin: { ...(await import("@/lib/insforge-admin")) },
  guard: { ...(await import("@/lib/auth-guard")) },
  visitor: { ...(await import("@/lib/bookings/visitor")) },
  action: { ...(await import("@/actions/event-registration")) },
};

let actions: typeof import("@/actions/event-registration");

beforeAll(async () => {
  mock.module("@/lib/insforge-admin", () => ({
    ...real.admin,
    getAdminClient: () => ({ database: db }),
  }));
  mock.module("@/lib/auth-guard", () => ({
    ...real.guard,
    authenticate: async (token: unknown) => {
      const role = { "client-token": "client", "partner-token": "partner" }[
        String(token)
      ];
      if (role) {
        return {
          userId: CLIENT,
          email: "ana@example.com",
          verifiedEmail: "ana@example.com",
          role,
        };
      }
      if (token === "staff-token" || token === "admin-token") {
        return {
          userId: "66666666-6666-4666-8666-666666666666",
          email: "team@example.com",
          verifiedEmail: "team@example.com",
          role: token === "staff-token" ? "staff" : "admin",
        };
      }
      throw new real.guard.AuthError("Invalid or expired session", 401);
    },
  }));
  mock.module("@/lib/bookings/visitor", () => ({
    ...real.visitor,
    readVisitor: async () => ({ claims: null, ip: null }),
  }));
  mock.module("@/actions/event-registration", () => real.action);
  actions = await import("@/actions/event-registration");
});

afterAll(() => {
  mock.module("@/lib/insforge-admin", () => real.admin);
  mock.module("@/lib/auth-guard", () => real.guard);
  mock.module("@/lib/bookings/visitor", () => real.visitor);
});

beforeEach(() => {
  rpcs = [];
  reads = [];
  failing = null;
});

let n = 0;
/** Exactly what the page's form sends; a fresh address each time, for the limits. */
const guest = (over: Record<string, unknown> = {}) => ({
  kind: "race",
  eventId: RACE,
  email: `guest${++n}@example.com`,
  firstName: "Ana",
  lastName: "García",
  phone: "600000000",
  language: "es",
  ...over,
});

describe("a guest registers, through the server", () => {
  test("for a run: her contact, with no consent, and the registration by that contact", async () => {
    const email = `ana${++n}@example.com`;
    expect(await actions.registerGuestForEvent(guest({ email }))).toEqual({
      ok: true,
    });
    expect(reads).toEqual(["races"]);
    expect(rpcs).toEqual([
      { name: "check_email_role", args: { p_email: email } },
      {
        name: "upsert_contact",
        args: {
          p_email: email,
          p_first_name: "Ana",
          p_last_name: "García",
          p_phone: "600000000",
          p_language: "es",
          p_gender: null,
          p_newsletter: null,
          p_whatsapp: null,
          p_whatsapp_marketing: null,
        },
      },
      {
        name: "register_for_race",
        args: { p_race_id: RACE, p_contact_id: "contact-1" },
      },
    ]);
  });

  test("for a session of the programmes, the same, with its own function", async () => {
    expect(
      await actions.registerGuestForEvent(
        guest({ kind: "education", eventId: SESSION }),
      ),
    ).toEqual({ ok: true });
    expect(reads).toEqual(["education_sessions"]);
    expect(rpcs.at(-1)).toEqual({
      name: "register_for_education",
      args: { p_session_id: SESSION, p_contact_id: "contact-1" },
    });
  });

  test("a member's address is told 'member', and nothing is written", async () => {
    expect(
      await actions.registerGuestForEvent(
        guest({ email: "member@example.com" }),
      ),
    ).toEqual({ ok: false, error: "member" });
    expect(rpcs.map((r) => r.name)).toEqual(["check_email_role"]);
  });

  test("an address of the team is not told anything about its role", async () => {
    expect(
      await actions.registerGuestForEvent(
        guest({ email: "admin@example.com" }),
      ),
    ).toEqual({ ok: true });
  });

  test("an event that does not exist registers nobody, and writes no contact", async () => {
    expect(
      await actions.registerGuestForEvent(guest({ eventId: MISSING })),
    ).toEqual({ ok: false, error: "not_found" });
    expect(rpcs).toEqual([]);
  });

  test.each([
    ["somebody's contact id", { contactId: SOMEONE }],
    ["somebody's account id", { userId: SOMEONE }],
    ["a parameter of the function", { p_contact_id: SOMEONE }],
    ["a consent", { newsletter: true }],
    ["another kind of event", { kind: "booking" }],
    ["an event id that is not one", { eventId: "" }],
    ["an address that is not one", { email: "ana.example.com" }],
  ])("%s is refused, and nothing is read or written", async (_what, over) => {
    expect(await actions.registerGuestForEvent(guest(over))).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(reads).toEqual([]);
    expect(rpcs).toEqual([]);
  });

  test("a database that does not answer is 'failed'", async () => {
    failing = "races";
    expect(await actions.registerGuestForEvent(guest())).toEqual({
      ok: false,
      error: "failed",
    });
    failing = "register_for_race";
    expect(await actions.registerGuestForEvent(guest())).toEqual({
      ok: false,
      error: "failed",
    });
  });

  test("one address: a few in ten minutes, then 'rate_limited' with nothing asked or written", async () => {
    const email = `limit${++n}@example.com`;
    for (let i = 0; i < 5; i++) {
      expect(await actions.registerGuestForEvent(guest({ email }))).toEqual({
        ok: true,
      });
    }
    rpcs = [];
    reads = [];
    expect(await actions.registerGuestForEvent(guest({ email }))).toEqual({
      ok: false,
      error: "rate_limited",
    });
    expect({ reads, rpcs }).toEqual({ reads: [], rpcs: [] });
  });
});

describe("a signed-in person registers, through the server", () => {
  test("herself: the account her token proves", async () => {
    expect(
      await actions.registerAccountForEvent("client-token", {
        kind: "race",
        eventId: RACE,
      }),
    ).toEqual({ ok: true });
    expect(rpcs).toEqual([
      {
        name: "register_for_race",
        args: { p_race_id: RACE, p_user_id: CLIENT },
      },
    ]);
  });

  test("naming her own account is the same", async () => {
    expect(
      await actions.registerAccountForEvent("client-token", {
        kind: "education",
        eventId: SESSION,
        userId: CLIENT,
      }),
    ).toEqual({ ok: true });
    expect(rpcs.at(-1)?.args).toEqual({
      p_session_id: SESSION,
      p_user_id: CLIENT,
    });
  });

  test.each(["client-token", "partner-token"])(
    "with %s, ANOTHER account is refused, with nothing read or written",
    async (token) => {
      expect(
        await actions.registerAccountForEvent(token, {
          kind: "race",
          eventId: RACE,
          userId: SOMEONE,
        }),
      ).toEqual({ ok: false, error: "forbidden" });
      expect({ reads, rpcs }).toEqual({ reads: [], rpcs: [] });
    },
  );

  test.each(["staff-token", "admin-token"])(
    "with %s, the team registers any account",
    async (token) => {
      expect(
        await actions.registerAccountForEvent(token, {
          kind: "race",
          eventId: RACE,
          userId: SOMEONE,
        }),
      ).toEqual({ ok: true });
      expect(rpcs.at(-1)?.args).toEqual({
        p_race_id: RACE,
        p_user_id: SOMEONE,
      });
    },
  );

  test.each([null, "expired-token"])(
    "with no session that checks out (%s), nobody is registered",
    async (token) => {
      expect(
        await actions.registerAccountForEvent(token, {
          kind: "race",
          eventId: RACE,
        }),
      ).toEqual({ ok: false, error: "session" });
      expect({ reads, rpcs }).toEqual({ reads: [], rpcs: [] });
    },
  );

  test("a contact id, or an event that does not exist, is refused", async () => {
    expect(
      await actions.registerAccountForEvent("client-token", {
        kind: "race",
        eventId: RACE,
        contactId: SOMEONE,
      }),
    ).toEqual({ ok: false, error: "invalid" });
    expect(
      await actions.registerAccountForEvent("client-token", {
        kind: "race",
        eventId: MISSING,
      }),
    ).toEqual({ ok: false, error: "not_found" });
    expect(rpcs).toEqual([]);
  });
});
