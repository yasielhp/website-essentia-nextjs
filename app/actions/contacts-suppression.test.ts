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
import {
  argsOf,
  chainDb,
  filters,
  has,
  type Step,
} from "@/lib/campaigns/fake-db";

/**
 * The two actions the contact's card uses for a number that wrote STOP. The
 * database and the role check are replaced; what is under test is who may call
 * them, what they touch and that they answer with a value and never throw.
 */

const CONTACT_ID = "3b7c1f6e-0d9a-4b52-8c1e-5a2f9d4e7b10";

let role: "admin" | "staff" | "none" = "admin";
let contactRow: { phone: string | null } | null = { phone: "600 11 22 33" };
let listed: string[] = [];
let tableError: string | null = null;
let contactError: string | null = null;
let log: { table: string; chain: Step[] }[] = [];

const real = {
  admin: { ...(await import("@/lib/insforge-admin")) },
  guard: { ...(await import("@/lib/auth-guard")) },
};
let fetchWhatsAppSuppression: typeof import("./contacts").fetchWhatsAppSuppression;
let clearWhatsAppSuppression: typeof import("./contacts").clearWhatsAppSuppression;

beforeAll(async () => {
  mock.module("@/lib/auth-guard", () => ({
    ...real.guard,
    requireRole: async (_token: string | null, roles?: readonly string[]) => {
      if (role === "none")
        throw new real.guard.AuthError("Authentication required", 401);
      if (roles && !roles.includes(role)) {
        throw new real.guard.AuthError(
          "Insufficient permissions for this operation",
          403,
        );
      }
      return { userId: "admin-1", email: "admin@example.test", role };
    },
  }));
  mock.module("@/lib/insforge-admin", () => ({
    getAdminClient: () => {
      const made = chainDb(async (table, chain) => {
        if (table === "contacts") {
          return contactError
            ? { data: null, error: { message: contactError } }
            : { data: contactRow, error: null };
        }
        if (table === "whatsapp_suppressed_phones") {
          if (tableError) return { data: null, error: { message: tableError } };
          const phones = (argsOf(chain, "in")?.[1] ?? [
            filters(chain).phone,
          ]) as string[];
          const hit = listed.filter((p) => phones.includes(p));
          if (has(chain, "delete")) {
            listed = listed.filter((p) => !hit.includes(p));
          }
          return { data: hit.map((phone) => ({ phone })), error: null };
        }
        return { data: [], error: null };
      });
      return {
        database: {
          from: (table: string) => {
            log = made.log;
            return made.db.from(table);
          },
        },
      };
    },
  }));
  ({ fetchWhatsAppSuppression, clearWhatsAppSuppression } =
    await import("./contacts"));
});

afterAll(() => {
  mock.module("@/lib/auth-guard", () => real.guard);
  mock.module("@/lib/insforge-admin", () => real.admin);
});

beforeEach(() => {
  role = "admin";
  contactRow = { phone: "600 11 22 33" };
  listed = ["+34600112233"];
  tableError = null;
  contactError = null;
  log = [];
});

describe("fetchWhatsAppSuppression", () => {
  test("says whether the contact's number is on the list, however it is written", async () => {
    expect(await fetchWhatsAppSuppression("t", CONTACT_ID)).toEqual({
      ok: true,
      suppressed: true,
    });
    listed = [];
    expect(await fetchWhatsAppSuppression("t", CONTACT_ID)).toEqual({
      ok: true,
      suppressed: false,
    });
  });

  test("a contact with no valid number is not suppressed, and the list is not read", async () => {
    contactRow = { phone: "abc" };
    expect(await fetchWhatsAppSuppression("t", CONTACT_ID)).toEqual({
      ok: true,
      suppressed: false,
    });
    expect(log.map((q) => q.table)).not.toContain("whatsapp_suppressed_phones");
  });

  test("only an administrator may ask", async () => {
    role = "staff";
    expect(await fetchWhatsAppSuppression("t", CONTACT_ID)).toEqual({
      ok: false,
      error: "forbidden",
    });
    role = "none";
    expect(await fetchWhatsAppSuppression(null, CONTACT_ID)).toEqual({
      ok: false,
      error: "unauthenticated",
    });
    expect(log).toHaveLength(0);
  });

  test("an id that is not a uuid is refused before any query", async () => {
    expect(await fetchWhatsAppSuppression("t", "1; drop table x")).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(log).toHaveLength(0);
  });

  test("an unknown contact is not found", async () => {
    contactRow = null;
    expect(await fetchWhatsAppSuppression("t", CONTACT_ID)).toEqual({
      ok: false,
      error: "notFound",
    });
  });

  test("a list that cannot be read (no table yet) answers a value, never throws", async () => {
    tableError = 'relation "whatsapp_suppressed_phones" does not exist';
    expect(await fetchWhatsAppSuppression("t", CONTACT_ID)).toEqual({
      ok: false,
      error: "db",
    });
  });
});

describe("clearWhatsAppSuppression", () => {
  test("takes the contact's number off the list, and only that one", async () => {
    listed = ["+34600112233", "+34611222333"];
    const info = spyOn(console, "info").mockImplementation(() => {});
    expect(await clearWhatsAppSuppression("t", CONTACT_ID)).toEqual({
      ok: true,
      removed: true,
    });
    expect(listed).toEqual(["+34611222333"]);
    info.mockRestore();
  });

  test("a number that was not on the list is a success that removed nothing", async () => {
    listed = [];
    expect(await clearWhatsAppSuppression("t", CONTACT_ID)).toEqual({
      ok: true,
      removed: false,
    });
  });

  test("it logs who and which contact, never the number", async () => {
    const info = spyOn(console, "info").mockImplementation(() => {});
    await clearWhatsAppSuppression("t", CONTACT_ID);
    expect(info).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(info.mock.calls[0]);
    expect(logged).toContain("admin-1");
    expect(logged).toContain(CONTACT_ID);
    expect(logged).not.toContain("600");
    info.mockRestore();
  });

  test("only an administrator may, and the list is untouched otherwise", async () => {
    role = "staff";
    expect(await clearWhatsAppSuppression("t", CONTACT_ID)).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(listed).toEqual(["+34600112233"]);
    expect(log).toHaveLength(0);
  });

  test("an id that is not a uuid is refused before any query", async () => {
    expect(await clearWhatsAppSuppression("t", "nope")).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(log).toHaveLength(0);
  });

  test("the number comes from the contact in the database, never from the caller", async () => {
    // There is nowhere to pass one: the signature is (token, contactId).
    expect(clearWhatsAppSuppression.length).toBe(2);
  });

  test("a database that fails answers a value, never throws", async () => {
    tableError = "boom";
    expect(await clearWhatsAppSuppression("t", CONTACT_ID)).toEqual({
      ok: false,
      error: "db",
    });
    tableError = null;
    contactError = "boom";
    expect(await clearWhatsAppSuppression("t", CONTACT_ID)).toEqual({
      ok: false,
      error: "db",
    });
  });
});
