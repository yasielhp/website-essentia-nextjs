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
 * The contact of a booking taken at the desk, written by the server
 * (`linkDeskContact`), run for real with the database and the role check
 * replaced.
 *
 * What is under test: only the team (admin, staff, partner) gets a contact
 * written; it goes through `upsert_contact` with the service key exactly as
 * the screen used to send it, with the newsletter as its switch says (`null`
 * when off) and no WhatsApp consent of any kind; and the input is a strict
 * object.
 *
 * Modules are put back afterwards: `mock.module` is process-wide.
 */

type Rpc = { name: string; args: Record<string, unknown> };
let rpcs: Rpc[] = [];
let role: string | null = "staff";
let failing = false;

const db = {
  rpc: async (name: string, args: Record<string, unknown>) => {
    rpcs.push({ name, args });
    if (failing) return { data: null, error: { message: "boom" } };
    return {
      data: name === "upsert_contact" ? "contact-1" : null,
      error: null,
    };
  },
};

const real = {
  admin: { ...(await import("@/lib/insforge-admin")) },
  guard: { ...(await import("@/lib/auth-guard")) },
};

let linkDeskContact: typeof import("@/actions/desk-booking").linkDeskContact;

beforeAll(async () => {
  mock.module("@/lib/insforge-admin", () => ({
    ...real.admin,
    getAdminClient: () => ({ database: db }),
  }));
  mock.module("@/lib/auth-guard", () => ({
    ...real.guard,
    requireRole: async (
      token: unknown,
      allowed: string[] = ["admin", "staff", "partner"],
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

describe("the desk's contact, written by the server", () => {
  test.each(["admin", "staff", "partner"])(
    "%s: written with the service key as the screen sent it, and no WhatsApp consent",
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

  test.each([
    ["no session", null, "staff"],
    ["a client", "token", "client"],
    ["a member", "token", "member"],
  ])("%s gets nothing written", async (_who, token, who) => {
    role = who;
    expect(await linkDeskContact(token, input())).toEqual({
      ok: false,
      error: "session",
    });
    expect(rpcs).toEqual([]);
  });

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
    expect(rpcs).toEqual([]);
  });

  test("a database that does not answer is 'failed'", async () => {
    failing = true;
    expect(await linkDeskContact("token", input())).toEqual({
      ok: false,
      error: "failed",
    });
  });
});
