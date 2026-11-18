import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import { argsOf, chainDb, has, type Step } from "@/lib/campaigns/fake-db";
import { AuthError } from "@/lib/auth-guard";
import { MESSAGE_KEYS } from "@/lib/messages/catalog";
import { WHATSAPP_MESSAGE_KEYS } from "@/lib/messages/whatsapp-row";

/**
 * The switch of a row of the list of Messages, through the real action, with
 * the role check and the database replaced. What matters: it is an admin's act,
 * it validates what it is given against the catalogue, it writes the switch and
 * NOTHING else (no text, no template, no author or date of an edit) in both
 * languages of the row, and turning it on never creates a row.
 */

let role: "admin" | "staff" | "none" = "admin";
let queries: { table: string; chain: Step[] }[] = [];
let failWrite = false;

const real = {
  admin: { ...(await import("@/lib/insforge-admin")) },
  guard: { ...(await import("@/lib/auth-guard")) },
  cache: { ...(await import("next/cache")) },
};
let setEnabled: typeof import("./message-templates").setMessageEnabled;
let revalidated = 0;

beforeAll(async () => {
  mock.module("next/cache", () => ({
    ...real.cache,
    revalidatePath: () => {
      revalidated += 1;
    },
  }));
  mock.module("@/lib/auth-guard", () => ({
    ...real.guard,
    requireRole: async () => {
      if (role === "none") throw new AuthError("no", 401);
      if (role === "staff") throw new AuthError("no", 403);
      return { userId: "admin-1", email: "a@example.test", role: "admin" };
    },
  }));
  mock.module("@/lib/insforge-admin", () => ({
    getAdminClient: () => {
      const made = chainDb(async (table, chain) => {
        queries.push({ table, chain: [...chain] });
        if (failWrite) return { data: null, error: { message: "boom" } };
        return { data: [], error: null };
      });
      return { database: { from: (table: string) => made.db.from(table) } };
    },
  }));
  ({ setMessageEnabled: setEnabled } = await import("./message-templates"));
});

afterAll(() => {
  mock.module("next/cache", () => real.cache);
  mock.module("@/lib/auth-guard", () => real.guard);
  mock.module("@/lib/insforge-admin", () => real.admin);
});

beforeEach(() => {
  role = "admin";
  queries = [];
  failWrite = false;
  revalidated = 0;
});

const writes = () => queries.filter((q) => q.table === "message_templates");
const upserted = () =>
  writes().flatMap((q) => (argsOf(q.chain, "upsert")?.[0] ?? []) as object[]);

describe("who may switch", () => {
  test("only an administrator: staff and an anonymous caller are refused, and nothing is written", async () => {
    role = "staff";
    expect(await setEnabled("t", "booking_paid", "email", false)).toEqual({
      ok: false,
      error: "forbidden",
    });
    role = "none";
    expect(await setEnabled("t", "booking_paid", "email", false)).toEqual({
      ok: false,
      error: "unauthenticated",
    });
    expect(queries).toHaveLength(0);
  });
});

describe("what it validates", () => {
  test("a key, channel or switch that is not the catalogue's is invalid, and nothing is written", async () => {
    for (const bad of [
      ["plan-test-x", "email", false],
      ["booking_paid", "sms", false],
      ["booking_paid", "email", "no"],
      ["booking_paid", "email", null],
      ["constructor", "email", true],
    ] as const) {
      expect(
        await setEnabled("t", bad[0], bad[1], bad[2] as unknown as boolean),
      ).toEqual({ ok: false, error: "invalid" });
    }
    expect(queries).toHaveLength(0);
  });

  test("a message that does not go out on WhatsApp has no WhatsApp switch", async () => {
    for (const key of MESSAGE_KEYS) {
      if (WHATSAPP_MESSAGE_KEYS.includes(key)) continue;
      expect(await setEnabled("t", key, "whatsapp", false)).toEqual({
        ok: false,
        error: "invalid",
      });
    }
    expect(queries).toHaveLength(0);
  });
});

describe("turning it off", () => {
  test("writes the two languages of the email with the switch and nothing else", async () => {
    expect(await setEnabled("t", "booking_paid", "email", false)).toEqual({
      ok: true,
    });
    expect(upserted()).toEqual([
      { key: "booking_paid", channel: "email", locale: "es", enabled: false },
      { key: "booking_paid", channel: "email", locale: "en", enabled: false },
    ]);
    expect(revalidated).toBe(1);
  });

  test("the reminder has one language: only Spanish", async () => {
    await setEnabled("t", "booking_reminder", "email", false);
    expect(upserted()).toEqual([
      {
        key: "booking_reminder",
        channel: "email",
        locale: "es",
        enabled: false,
      },
    ]);
  });

  test("the WhatsApp switch is its own, in both languages, whether or not it is set up", async () => {
    await setEnabled("t", "booking_confirmed", "whatsapp", false);
    expect(upserted()).toEqual([
      {
        key: "booking_confirmed",
        channel: "whatsapp",
        locale: "es",
        enabled: false,
      },
      {
        key: "booking_confirmed",
        channel: "whatsapp",
        locale: "en",
        enabled: false,
      },
    ]);
  });

  test("it is an upsert on the row's address, so an existing text is left as it is", async () => {
    await setEnabled("t", "booking_paid", "email", false);
    const [first] = writes();
    expect(argsOf(first!.chain, "upsert")![1]).toEqual({
      onConflict: "key,channel,locale",
    });
  });
});

describe("turning it on", () => {
  test("only updates the rows that exist, to on, and never creates one: no row is already on", async () => {
    expect(await setEnabled("t", "booking_paid", "email", true)).toEqual({
      ok: true,
    });
    const [q] = writes();
    expect(has(q!.chain, "upsert")).toBe(false);
    expect(has(q!.chain, "insert")).toBe(false);
    expect(argsOf(q!.chain, "update")![0]).toEqual({ enabled: true });
    expect(argsOf(q!.chain, "in")).toEqual(["locale", ["es", "en"]]);
    expect(q!.chain.filter((s) => s.name === "eq").map((s) => s.args)).toEqual([
      ["key", "booking_paid"],
      ["channel", "email"],
    ]);
  });

  test("it writes no author and no date of an edit: the list's 'saved on' is the text's, not the switch's", async () => {
    await setEnabled("t", "booking_paid", "email", true);
    await setEnabled("t", "booking_paid", "email", false);
    for (const q of writes()) {
      const body = JSON.stringify([
        argsOf(q.chain, "update"),
        argsOf(q.chain, "upsert"),
      ]);
      expect(body).not.toContain("updated_by");
      expect(body).not.toContain("updated_at");
      for (const column of [
        "subject",
        "preheader",
        "title",
        "doc",
        "whatsapp",
      ]) {
        expect(body).not.toContain(column);
      }
    }
  });
});

describe("when the database fails", () => {
  test("the answer is an error, not a success", async () => {
    failWrite = true;
    expect(await setEnabled("t", "booking_paid", "email", false)).toEqual({
      ok: false,
      error: "db",
    });
    expect(await setEnabled("t", "booking_paid", "email", true)).toEqual({
      ok: false,
      error: "db",
    });
  });
});
