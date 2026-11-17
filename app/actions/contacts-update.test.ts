import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import { argsOf, chainDb, filters, type Query } from "@/lib/campaigns/fake-db";
import type { UpdateContactPayload } from "@/types/contact";

/**
 * `updateContact` run for real with its role check and its database replaced.
 * It writes with the service key, so what is under test is that ONLY the
 * fields of the details form can reach the database (a consent date or a STOP
 * sent along is a refusal, not a write) and that the database's own words never
 * reach the caller.
 *
 * Modules are put back afterwards: `mock.module` is process-wide.
 */

const ID = "11111111-1111-4111-8111-111111111111";

let role: string | null = "staff";
let dbError: { message: string; code?: string } | null = null;
let log: Query[] = [];

const real = {
  admin: { ...(await import("@/lib/insforge-admin")) },
  guard: { ...(await import("@/lib/auth-guard")) },
};

let updateContact: typeof import("@/actions/contacts").updateContact;

beforeAll(async () => {
  mock.module("@/lib/insforge-admin", () => ({
    ...real.admin,
    getAdminClient: () => {
      const made = chainDb(async () => ({ data: null, error: dbError }));
      log = made.log;
      return { database: made.db };
    },
  }));
  mock.module("@/lib/auth-guard", () => ({
    ...real.guard,
    // Honours the roles it is asked for, as the real one does.
    requireRole: async (
      _token: string | null,
      allowed: string[] = real.guard.DASHBOARD_ROLES,
    ) => {
      if (!role) throw new real.guard.AuthError("Authentication required", 401);
      if (!allowed.includes(role)) {
        throw new real.guard.AuthError(
          "Insufficient permissions for this operation",
          403,
        );
      }
      return { userId: "staff-1", email: "staff@example.com", role };
    },
  }));
  ({ updateContact } = await import("@/actions/contacts"));
});

afterAll(() => {
  mock.module("@/lib/insforge-admin", () => real.admin);
  mock.module("@/lib/auth-guard", () => real.guard);
});

beforeEach(() => {
  role = "staff";
  dbError = null;
  log = [];
});

/** Exactly what the details form of the contact page sends. */
const details = (): UpdateContactPayload => ({
  first_name: "Ana",
  last_name: "García",
  email: "ana@example.com",
  phone: "+34600112233",
  preferred_language: "es",
  gender: "female",
  birthdate: "1990-05-17",
});

const sneak = (extra: Record<string, unknown>) =>
  ({ ...details(), ...extra }) as unknown as UpdateContactPayload;

describe("updateContact", () => {
  test("the details form saves its seven fields, on that contact", async () => {
    expect(await updateContact("token", ID, details())).toEqual({
      error: null,
    });
    expect(log).toHaveLength(1);
    expect(log[0]!.table).toBe("contacts");
    expect(argsOf(log[0]!.chain, "update")?.[0]).toEqual(details());
    expect(filters(log[0]!.chain)).toEqual({ id: ID });
  });

  test("what may be empty is saved as empty", async () => {
    const empty: UpdateContactPayload = {
      ...details(),
      last_name: null,
      email: null,
      phone: null,
      gender: null,
      birthdate: null,
      preferred_language: "en",
    };
    expect((await updateContact("token", ID, empty)).error).toBeNull();
    expect(argsOf(log[0]!.chain, "update")?.[0]).toEqual(empty);
  });

  test.each([
    ["lifting a STOP", { whatsapp_opted_out_at: null }],
    [
      "a consent to the booking notices",
      { whatsapp_opted_in_at: "2026-01-01" },
    ],
    [
      "a consent to marketing",
      { whatsapp_marketing_opted_in_at: "2026-01-01T00:00:00Z" },
    ],
    ["the unreachable mark", { whatsapp_unreachable_at: null }],
    ["the newsletter", { newsletter_subscribed: true }],
    ["the email unsubscribe", { newsletter_unsubscribed_at: null }],
    ["a bounce", { email_bounced_at: null }],
    ["the lifecycle", { status: "member" }],
    ["the id itself", { id: "22222222-2222-4222-8222-222222222222" }],
    ["the unsubscribe token", { unsubscribe_token: "known-to-me" }],
  ])("a column the form does not have is refused: %s", async (_name, extra) => {
    const result = await updateContact("token", ID, sneak(extra));
    expect(result.error).not.toBeNull();
    // Refused whole: not even the legitimate fields are written.
    expect(log).toHaveLength(0);
  });

  test("a payload that is not the form's is refused without a write or a crash", async () => {
    const partial = { first_name: "Ana" };
    for (const payload of [
      null,
      undefined,
      "first_name=Ana",
      7,
      [],
      {},
      partial,
      sneak({ first_name: "" }),
      sneak({ first_name: 7 }),
      sneak({ email: "not-an-address" }),
      sneak({ preferred_language: "fr" }),
      sneak({ gender: "x" }),
      sneak({ birthdate: "tomorrow" }),
      sneak({ birthdate: "1990-13-45" }),
      sneak({ phone: { $ne: null } }),
    ]) {
      const result = await updateContact(
        "token",
        ID,
        payload as unknown as UpdateContactPayload,
      );
      expect(result.error).not.toBeNull();
    }
    expect(log).toHaveLength(0);
  });

  test("an id that is not a uuid is refused before the database", async () => {
    for (const id of ["", "1", "not-a-uuid", `${ID} or 1=1`, null, undefined]) {
      const result = await updateContact(
        "token",
        id as unknown as string,
        details(),
      );
      expect(result.error).not.toBeNull();
    }
    expect(log).toHaveLength(0);
  });

  test("the database's own words stay in the log, not in the answer", async () => {
    const loud = spyOn(console, "error").mockImplementation(() => {});
    dbError = {
      message: 'column "secret_column" of relation "contacts" does not exist',
      code: "42703",
    };
    const result = await updateContact("token", ID, details());
    const logged = JSON.stringify(loud.mock.calls);
    loud.mockRestore();
    expect(result.error).not.toBeNull();
    expect(result.error).not.toContain("secret_column");
    expect(result.error).not.toContain("relation");
    expect(logged).toContain("secret_column");
  });

  test("an address another contact has says so, without the constraint's name", async () => {
    const loud = spyOn(console, "error").mockImplementation(() => {});
    dbError = {
      message:
        'duplicate key value violates unique constraint "contacts_email_key"',
      code: "23505",
    };
    const result = await updateContact("token", ID, details());
    loud.mockRestore();
    expect(result.error).toMatch(/email/i);
    expect(result.error).not.toContain("contacts_email_key");
  });

  test("without a dashboard role nothing is written", async () => {
    for (const who of [null, "contact", "member"]) {
      role = who;
      const result = await updateContact("token", ID, details());
      expect(result.error).not.toBeNull();
    }
    expect(log).toHaveLength(0);
  });
});
