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
 * The contact of a booking taken at the desk, written by the server
 * (`linkDeskContact`), run for real with the database and the session check
 * replaced. The roles let in are the real `DASHBOARD_ROLES`.
 *
 * What is under test: only the team gets a contact written; admin and staff
 * write it through `upsert_contact` exactly as the screen used to send it
 * (the newsletter as its switch says, `null` when off, and no WhatsApp
 * consent of any kind); a partner links an existing contact or creates a new
 * one, and never changes an existing contact's name, phone, language or
 * subscriptions; and the input is a strict object.
 *
 * Modules are put back afterwards: `mock.module` is process-wide.
 */

type Rpc = { name: string; args: Record<string, unknown> };
let rpcs: Rpc[] = [];
let rows: Row[] = [];
let inserts: Row[] = [];
let role: string | null = "staff";
let failing = false;

const real = {
  admin: { ...(await import("@/lib/insforge-admin")) },
  guard: { ...(await import("@/lib/auth-guard")) },
};

function database() {
  const { db, calls } = fakeDb(rows, {
    failOn: failing ? "write" : undefined,
  });
  inserts = calls.inserts;
  return Object.assign(db as object, {
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcs.push({ name, args });
      if (failing) return { data: null, error: { message: "boom" } };
      return {
        data: name === "upsert_contact" ? "contact-1" : null,
        error: null,
      };
    },
  });
}

let linkDeskContact: typeof import("@/actions/desk-booking").linkDeskContact;

beforeAll(async () => {
  mock.module("@/lib/insforge-admin", () => ({
    ...real.admin,
    getAdminClient: () => ({ database: database() }),
  }));
  mock.module("@/lib/auth-guard", () => ({
    ...real.guard,
    // The real check, with the real list of roles; only the session is made up.
    requireRole: async (
      token: unknown,
      allowed: string[] = real.guard.DASHBOARD_ROLES,
    ) => {
      if (!token || !role) {
        throw new real.guard.AuthError("Authentication required", 401);
      }
      if (!allowed.includes(role)) {
        throw new real.guard.AuthError("Insufficient permissions", 403);
      }
      return { userId: "me", email: null, verifiedEmail: null, role };
    },
  }));
  ({ linkDeskContact } = await import("@/actions/desk-booking"));
});

afterAll(() => {
  mock.module("@/lib/insforge-admin", () => real.admin);
  mock.module("@/lib/auth-guard", () => real.guard);
});

beforeEach(() => {
  rpcs = [];
  rows = [];
  inserts = [];
  role = "staff";
  failing = false;
});

/** Exactly what the desk's screen sends. */
const input = (over: Record<string, unknown> = {}) => ({
  email: "ana@example.com",
  firstName: "Ana",
  lastName: "",
  phone: null,
  language: "es",
  gender: null,
  newsletter: true,
  ...over,
});

/** A client already on file. */
const onFile = (over: Row = {}): Row => ({
  id: "c-ana",
  email: "ana@example.com",
  first_name: "Ana María",
  last_name: "Pérez",
  phone: "+34611222333",
  preferred_language: "en",
  newsletter_subscribed: false,
  newsletter_unsubscribed_at: null,
  whatsapp_marketing_opted_in_at: null,
  whatsapp_opted_out_at: null,
  updated_at: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("the roles are the real ones", () => {
  test("the dashboard's roles are admin, staff and partner", () => {
    expect(real.guard.DASHBOARD_ROLES).toEqual(["admin", "staff", "partner"]);
  });

  test.each(["client", "member"])(
    "%s gets nothing written, nor does no session",
    async (who) => {
      role = who;
      expect(await linkDeskContact("token", input())).toEqual({
        ok: false,
        error: "session",
      });
      role = "staff";
      expect(await linkDeskContact(null, input())).toEqual({
        ok: false,
        error: "session",
      });
      expect({ rpcs, inserts }).toEqual({ rpcs: [], inserts: [] });
    },
  );
});

describe("admin and staff: the contact as the screen always wrote it", () => {
  test.each(["admin", "staff"])(
    "%s: `upsert_contact` with the service key, the newsletter as its switch says, and no WhatsApp consent",
    async (who) => {
      role = who;
      expect(await linkDeskContact("token", input())).toEqual({
        ok: true,
        contactId: "contact-1",
      });
      expect(rpcs).toEqual([
        {
          name: "upsert_contact",
          args: {
            p_email: "ana@example.com",
            p_first_name: "Ana",
            p_last_name: "",
            p_phone: null,
            p_language: "es",
            p_gender: null,
            p_newsletter: true,
            p_whatsapp: null,
            p_whatsapp_marketing: null,
          },
        },
      ]);
    },
  );

  test("the newsletter switch off is null: it touches nothing", async () => {
    await linkDeskContact(
      "token",
      input({ newsletter: null, phone: "600000000", gender: "male" }),
    );
    expect(rpcs[0]?.args).toMatchObject({
      p_newsletter: null,
      p_phone: "600000000",
      p_gender: "male",
    });
  });
});

describe("a partner: links or creates, never changes an existing contact", () => {
  test("an existing contact is linked as it is: name, phone, language and subscriptions stay", async () => {
    role = "partner";
    rows = [onFile()];
    expect(
      await linkDeskContact(
        "token",
        input({ firstName: "Otra", phone: "699000111", language: "es" }),
      ),
    ).toEqual({ ok: true, contactId: "c-ana" });
    expect(rpcs).toEqual([]);
    expect(inserts).toEqual([]);
    expect(rows[0]).toEqual(onFile());
  });

  test("an unsubscribe on file stays too, whatever the switch says", async () => {
    role = "partner";
    rows = [onFile({ newsletter_unsubscribed_at: "2026-02-01T00:00:00.000Z" })];
    await linkDeskContact("token", input({ newsletter: true }));
    expect(rows[0]).toEqual(
      onFile({ newsletter_unsubscribed_at: "2026-02-01T00:00:00.000Z" }),
    );
  });

  test("a new address is created as the screen sent it, the newsletter as its switch says", async () => {
    role = "partner";
    expect(
      await linkDeskContact("token", input({ phone: "600000000" })),
    ).toEqual({ ok: true, contactId: "c1" });
    expect(rpcs).toEqual([]);
    expect(inserts).toEqual([
      expect.objectContaining({
        email: "ana@example.com",
        first_name: "Ana",
        phone: "600000000",
        preferred_language: "es",
        newsletter_subscribed: true,
        whatsapp_marketing_opted_in_at: null,
      }),
    ]);
  });
});

describe("what is refused", () => {
  test.each([
    ["a WhatsApp consent", { whatsapp: true }],
    ["marketing on WhatsApp", { whatsappMarketing: true }],
    ["the newsletter as false", { newsletter: false }],
    ["an address that is not one", { email: "ana" }],
    ["a language the site does not have", { language: "fr" }],
  ])("%s is refused, and nothing is written", async (_what, over) => {
    expect(await linkDeskContact("token", input(over))).toEqual({
      ok: false,
      error: "invalid",
    });
    expect({ rpcs, inserts }).toEqual({ rpcs: [], inserts: [] });
  });

  test("a database that does not answer is 'failed'", async () => {
    failing = true;
    expect(await linkDeskContact("token", input())).toEqual({
      ok: false,
      error: "failed",
    });
    role = "partner";
    expect(await linkDeskContact("token", input())).toEqual({
      ok: false,
      error: "failed",
    });
  });
});
