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
import { EMPTY_AUDIENCE } from "@/types/campaign";
import { chainDb } from "./fake-db";

/**
 * `resolveAudience` over a replaced database. What matters here is the STOP
 * list: a WhatsApp audience leaves out the numbers on it, one that cannot be
 * read (its table is created by a migration) makes the audience impossible to
 * resolve rather than unfiltered, and email never reads it.
 */

const CONTACT = {
  id: "c-1",
  email: "ana@example.test",
  first_name: "Ana",
  last_name: null,
  phone: "600 11 22 33",
  preferred_language: "es",
  newsletter_subscribed: true,
  email_bounced_at: null,
  newsletter_unsubscribed_at: null,
  newsletter_subscribed_at: null,
  birthdate: null,
  whatsapp_marketing_opted_in_at: "2026-11-01T00:00:00Z",
  whatsapp_opted_out_at: null,
  whatsapp_unreachable_at: null,
};

let suppressed: string[] = [];
let suppressedError: string | null = null;
let tablesRead: string[] = [];

const real = { admin: { ...(await import("@/lib/insforge-admin")) } };
let resolveAudience: typeof import("./audience").resolveAudience;

beforeAll(async () => {
  mock.module("@/lib/insforge-admin", () => ({
    getAdminClient: () => ({
      database: chainDb(async (table) => {
        tablesRead.push(table);
        if (table === "contacts") return { data: [CONTACT], error: null };
        if (table === "whatsapp_suppressed_phones") {
          return suppressedError
            ? { data: null, error: { message: suppressedError } }
            : { data: suppressed.map((phone) => ({ phone })), error: null };
        }
        return { data: [], error: null };
      }).db,
    }),
  }));
  ({ resolveAudience } = await import("./audience"));
});

afterAll(() => {
  mock.module("@/lib/insforge-admin", () => real.admin);
});

beforeEach(() => {
  suppressed = [];
  suppressedError = null;
  tablesRead = [];
});

const EVERYONE = EMPTY_AUDIENCE;
const NOW = new Date("2026-11-17T12:00:00Z");

describe("resolveAudience and the STOP list", () => {
  test("a WhatsApp audience leaves out a number on the list", async () => {
    suppressed = ["+34600112233"];
    expect(await resolveAudience(EVERYONE, NOW, "whatsapp")).toEqual([]);
  });

  test("and keeps it when the list does not have it", async () => {
    suppressed = ["+34999999999"];
    const out = await resolveAudience(EVERYONE, NOW, "whatsapp");
    expect(out.map((r) => r.phone)).toEqual(["+34600112233"]);
  });

  test("a list that cannot be read makes the audience fail, never unfiltered", async () => {
    suppressedError = 'relation "whatsapp_suppressed_phones" does not exist';
    await expect(resolveAudience(EVERYONE, NOW, "whatsapp")).rejects.toThrow(
      "does not exist",
    );
  });

  test("email never reads the list, so it works whether the table exists or not", async () => {
    suppressedError = "no table";
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    const out = await resolveAudience(EVERYONE, NOW, "email");
    quiet.mockRestore();
    expect(out.map((r) => r.email)).toEqual(["ana@example.test"]);
    expect(tablesRead).not.toContain("whatsapp_suppressed_phones");
    const byDefault = await resolveAudience(EVERYONE, NOW);
    expect(byDefault).toHaveLength(1);
    expect(tablesRead).not.toContain("whatsapp_suppressed_phones");
  });
});
