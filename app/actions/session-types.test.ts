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
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import {
  argsOf,
  chainDb,
  filters,
  has,
  type Query,
} from "@/lib/campaigns/fake-db";
import { TIER_PRICES_CACHE_TAG } from "@/lib/treatments/prices";
import type { SessionTypeInput, SessionTypeSaveError } from "@/types/settings";

/**
 * `saveSessionType` run for real, with the session check, the database and
 * Next's cache replaced. A session type's price is what the booking flow
 * charges and what the site prints, so what is under test is WHO may write it
 * (administrators, through the server), WHAT may be written (the fields of the
 * form, checked), that the site is told at once, and that it always answers.
 *
 * And, read from the source, that this is the ONLY way the table is written:
 * it used to be written from the browser, with a table anybody holding the
 * public key could write to.
 *
 * Modules are put back afterwards: `mock.module` is process-wide.
 */

const TIER = "11111111-1111-4111-8111-111111111111";
const ANA = "22222222-2222-4222-8222-222222222222";
const BEA = "33333333-3333-4333-8333-333333333333";
const OLD = "44444444-4444-4444-8444-444444444444";

type Answer = {
  data: unknown;
  error: { message: string; code?: string } | null;
};

let role: string | null = "admin";
let authHangs = false;
let asked: { token: unknown; allowed: unknown }[] = [];
let dropped: string[] = [];
let cacheFails = false;
let log: Query[] = [];
/** What the database answers; `undefined` is the happy path. */
let answer: (
  table: string,
  kind: string,
) => Answer | Promise<Answer> | undefined;
let assigned: string[] = [];

const kindOf = (query: Pick<Query, "chain">): string =>
  ["update", "upsert", "delete", "insert"].find((op) => has(query.chain, op)) ??
  "select";

const real = {
  cache: { ...(await import("next/cache")) },
  guard: { ...(await import("@/lib/auth-guard")) },
  admin: { ...(await import("@/lib/insforge-admin")) },
};

let saveSessionType: typeof import("@/actions/session-types").saveSessionType;
let saveSessionTypeCore: typeof import("@/lib/session-types/save").saveSessionTypeCore;

beforeAll(async () => {
  mock.module("next/cache", () => ({
    ...real.cache,
    updateTag: (tag: string) => {
      if (cacheFails) throw new Error("no cache here");
      dropped.push(tag);
    },
  }));
  mock.module("@/lib/auth-guard", () => ({
    ...real.guard,
    requireRole: async (token: unknown, allowed: string[]) => {
      asked.push({ token, allowed });
      if (authHangs) await new Promise(() => {});
      if (!token || !role) {
        throw new real.guard.AuthError("Authentication required", 401);
      }
      if (!allowed.includes(role)) {
        throw new real.guard.AuthError("Insufficient permissions", 403);
      }
      return { userId: "u1", email: null, verifiedEmail: null, role };
    },
  }));
  mock.module("@/lib/insforge-admin", () => ({
    ...real.admin,
    getAdminClient: () => {
      const made = chainDb(async (table, chain) => {
        const kind = kindOf({ chain });
        const custom = await answer(table, kind);
        if (custom) return custom;
        if (table === "service_tiers") {
          return { data: [{ id: TIER }], error: null };
        }
        if (table === "staff_tiers" && kind === "select") {
          return {
            data: assigned.map((staff_id) => ({ staff_id })),
            error: null,
          };
        }
        return { data: null, error: null };
      });
      log = made.log;
      return { database: made.db };
    },
  }));
  ({ saveSessionType } = await import("@/actions/session-types"));
  ({ saveSessionTypeCore } = await import("@/lib/session-types/save"));
});

afterAll(() => {
  mock.module("next/cache", () => real.cache);
  mock.module("@/lib/auth-guard", () => real.guard);
  mock.module("@/lib/insforge-admin", () => real.admin);
});

beforeEach(() => {
  role = "admin";
  authHangs = false;
  asked = [];
  dropped = [];
  cacheFails = false;
  log = [];
  answer = () => undefined;
  assigned = [];
});

/** Exactly what the modal of Settings sends. */
const form = (over: Partial<SessionTypeInput> = {}): SessionTypeInput => ({
  duration_minutes: 60,
  price_eur: 81,
  price_center_eur: 90,
  price_suite_eur: 120,
  color: "#6b7280",
  active: true,
  staffIds: null,
  ...over,
});

const sneak = (extra: Record<string, unknown>) =>
  ({ ...form(), ...extra }) as unknown as SessionTypeInput;

const on = (table: string, kind?: string) =>
  log.filter(
    (q) => q.table === table && (kind === undefined || kindOf(q) === kind),
  );

describe("saveSessionType", () => {
  test("an administrator saves the fields of the form, on that session type, with the service key", async () => {
    expect(await saveSessionType("token", TIER, form())).toEqual({ ok: true });
    expect(asked).toEqual([
      { token: "token", allowed: real.guard.ADMIN_ROLES },
    ]);
    const writes = on("service_tiers");
    expect(writes).toHaveLength(1);
    expect(argsOf(writes[0]!.chain, "update")?.[0]).toEqual({
      duration_minutes: 60,
      price_eur: 81,
      price_center_eur: 90,
      price_suite_eur: 120,
      color: "#6b7280",
      active: true,
    });
    expect(filters(writes[0]!.chain)).toEqual({ id: TIER });
    // The staff were not sent, so their assignments are not looked at.
    expect(on("staff_tiers")).toHaveLength(0);
  });

  test("the site is told at once: the tag of the prices is dropped after the write", async () => {
    await saveSessionType("token", TIER, form({ price_eur: 75 }));
    expect(dropped).toEqual([TIER_PRICES_CACHE_TAG]);
    expect(TIER_PRICES_CACHE_TAG).toBe("tier-prices");
  });

  test("what may be empty is saved as empty, and switching one off is a save like any other", async () => {
    const empty = form({
      duration_minutes: null,
      price_eur: null,
      price_center_eur: null,
      price_suite_eur: null,
      color: null,
      active: false,
    });
    expect(await saveSessionType("token", TIER, empty)).toEqual({ ok: true });
    expect(argsOf(on("service_tiers")[0]!.chain, "update")?.[0]).toEqual({
      duration_minutes: null,
      price_eur: null,
      price_center_eur: null,
      price_suite_eur: null,
      color: null,
      active: false,
    });
    expect(dropped).toEqual([TIER_PRICES_CACHE_TAG]);
  });

  test("a cache that cannot be dropped does not undo the save: the price shows when the five minutes pass", async () => {
    cacheFails = true;
    expect(await saveSessionType("token", TIER, form())).toEqual({ ok: true });
  });
});

describe("who may save a session type", () => {
  const others: [string, string | null, SessionTypeSaveError][] = [
    ["staff", "staff", "forbidden"],
    ["a partner", "partner", "forbidden"],
    ["a client with an account", "contact", "forbidden"],
    ["nobody (no profile behind the token)", null, "unauthenticated"],
  ];
  test.each(others)(
    "%s cannot: nothing is written and the site is not told",
    async (_who, as, error) => {
      role = as;
      expect(await saveSessionType("token", TIER, form())).toEqual({
        ok: false,
        error,
      });
      expect(log).toHaveLength(0);
      expect(dropped).toEqual([]);
    },
  );

  test("no token at all is refused the same way", async () => {
    expect(await saveSessionType(null, TIER, form())).toEqual({
      ok: false,
      error: "unauthenticated",
    });
    expect(log).toHaveLength(0);
    expect(dropped).toEqual([]);
  });
});

describe("what may be saved", () => {
  test.each([
    ["the name", { label: "Free massage" }],
    ["the service it belongs to", { service_id: "manual-therapies" }],
    ["its position", { sort_order: 0 }],
    ["its picture", { image_url: "https://example.test/x.png" }],
    ["its id", { id: "55555555-5555-4555-8555-555555555555" }],
    ["a payment product", { stripe_price_id: "price_1" }],
    ["the date it was made", { created_at: "2020-01-01" }],
  ])(
    "a column the form does not have is refused whole: %s",
    async (_name, extra) => {
      expect(await saveSessionType("token", TIER, sneak(extra))).toEqual({
        ok: false,
        error: "invalid",
      });
      expect(log).toHaveLength(0);
      expect(dropped).toEqual([]);
    },
  );

  test.each([
    ["a negative price", { price_eur: -1 }],
    ["a price in text", { price_eur: "81" }],
    ["a price with more than two decimals", { price_center_eur: 89.999 }],
    ["a price that is not a number", { price_suite_eur: Number.NaN }],
    ["an endless price", { price_eur: Number.POSITIVE_INFINITY }],
    ["an absurd price", { price_eur: 1_000_000 }],
    ["a length of nothing", { duration_minutes: 0 }],
    ["a negative length", { duration_minutes: -30 }],
    ["half a minute", { duration_minutes: 60.5 }],
    ["a length of more than a day", { duration_minutes: 1441 }],
    ["a colour that is not one", { color: "red" }],
    ["a colour with markup in it", { color: '#fff"><script>' }],
    ["a switch that is not yes or no", { active: "true" }],
    ["a missing field", { active: undefined }],
    ["staff that are not ids", { staffIds: ["ana"] }],
    ["the same person twice", { staffIds: [ANA, ANA] }],
    ["staff that are not a list", { staffIds: ANA }],
  ])("%s is refused, and nothing is written", async (_name, extra) => {
    expect(await saveSessionType("token", TIER, sneak(extra))).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(log).toHaveLength(0);
    expect(dropped).toEqual([]);
  });

  test("prices in cents and zero are fine: a session can be free", async () => {
    const result = await saveSessionType(
      "token",
      TIER,
      form({ price_eur: 0, price_center_eur: 19.99, price_suite_eur: 0.1 }),
    );
    expect(result).toEqual({ ok: true });
  });

  test("what is not the form at all is refused without a crash", async () => {
    for (const input of [null, undefined, "price_eur=1", 7, [], {}]) {
      expect(
        await saveSessionType(
          "token",
          TIER,
          input as unknown as SessionTypeInput,
        ),
      ).toEqual({ ok: false, error: "invalid" });
    }
    for (const id of ["", "1", `${TIER} or 1=1`, null, undefined, {}]) {
      expect(
        await saveSessionType("token", id as unknown as string, form()),
      ).toEqual({ ok: false, error: "invalid" });
    }
    expect(log).toHaveLength(0);
  });
});

describe("the people who perform it", () => {
  test("the list sent becomes the assignments, in its order, and whoever is no longer on it is removed", async () => {
    assigned = [OLD, ANA];
    expect(
      await saveSessionType("token", TIER, form({ staffIds: [BEA, ANA] })),
    ).toEqual({ ok: true });

    const upserts = on("staff_tiers", "upsert");
    expect(upserts).toHaveLength(1);
    expect(argsOf(upserts[0]!.chain, "upsert")).toEqual([
      [
        { staff_id: BEA, tier_id: TIER, sort_order: 0 },
        { staff_id: ANA, tier_id: TIER, sort_order: 1 },
      ],
      { onConflict: "staff_id,tier_id" },
    ]);

    const removals = on("staff_tiers", "delete");
    expect(removals).toHaveLength(1);
    expect(filters(removals[0]!.chain)).toEqual({ tier_id: TIER });
    expect(argsOf(removals[0]!.chain, "in")).toEqual(["staff_id", [OLD]]);
  });

  test("the new ones are written BEFORE the old ones are removed, so it is never left with nobody", async () => {
    assigned = [OLD];
    await saveSessionType("token", TIER, form({ staffIds: [ANA] }));
    const order = on("staff_tiers").map(kindOf);
    expect(order.indexOf("upsert")).toBeGreaterThan(-1);
    expect(order.indexOf("upsert")).toBeLessThan(order.indexOf("delete"));
  });

  test("an empty list unassigns everybody; nobody to remove removes nobody", async () => {
    assigned = [OLD, ANA];
    await saveSessionType("token", TIER, form({ staffIds: [] }));
    expect(on("staff_tiers", "upsert")).toHaveLength(0);
    expect(argsOf(on("staff_tiers", "delete")[0]!.chain, "in")).toEqual([
      "staff_id",
      [OLD, ANA],
    ]);

    assigned = [ANA];
    await saveSessionType("token", TIER, form({ staffIds: [ANA] }));
    expect(on("staff_tiers", "delete")).toHaveLength(0);
  });

  test("assignments that cannot be written say so apart: the session type was saved, and the site is told", async () => {
    const loud = spyOn(console, "error").mockImplementation(() => {});
    answer = (table, kind) =>
      table === "staff_tiers" && kind === "upsert"
        ? { data: null, error: { message: "fk violation on staff_id" } }
        : undefined;
    const result = await saveSessionType(
      "token",
      TIER,
      form({ staffIds: [ANA] }),
    );
    const logged = JSON.stringify(loud.mock.calls);
    loud.mockRestore();
    expect(result).toEqual({ ok: false, error: "staff" });
    expect(logged).toContain("fk violation");
    expect(on("staff_tiers", "delete")).toHaveLength(0);
    expect(dropped).toEqual([TIER_PRICES_CACHE_TAG]);
  });
});

describe("when the database does not take it", () => {
  test("a session type that is not there is said to be gone, and nothing else is tried", async () => {
    answer = (table) =>
      table === "service_tiers" ? { data: [], error: null } : undefined;
    const result = await saveSessionType(
      "token",
      TIER,
      form({ staffIds: [ANA] }),
    );
    expect(result).toEqual({ ok: false, error: "notFound" });
    expect(on("staff_tiers")).toHaveLength(0);
    expect(dropped).toEqual([]);
  });

  test("the database's own words stay in the log, not in the answer", async () => {
    const loud = spyOn(console, "error").mockImplementation(() => {});
    answer = (table) =>
      table === "service_tiers"
        ? {
            data: null,
            error: {
              message: 'permission denied for table "service_tiers"',
              code: "42501",
            },
          }
        : undefined;
    const result = await saveSessionType("token", TIER, form());
    const logged = JSON.stringify(loud.mock.calls);
    loud.mockRestore();
    expect(result).toEqual({ ok: false, error: "failed" });
    expect(logged).toContain("permission denied");
    expect(dropped).toEqual([]);
  });

  test("a colour another session type wears is named as that, from the unique index", async () => {
    const loud = spyOn(console, "error").mockImplementation(() => {});
    answer = (table) =>
      table === "service_tiers"
        ? {
            data: null,
            error: {
              message:
                'duplicate key value violates unique constraint "service_tiers_color_unique"',
              code: "23505",
            },
          }
        : undefined;
    const result = await saveSessionType("token", TIER, form());
    loud.mockRestore();
    expect(result).toEqual({ ok: false, error: "colorTaken" });
  });

  test("a client that throws is an answer too, never an exception in the screen", async () => {
    const loud = spyOn(console, "error").mockImplementation(() => {});
    answer = () => {
      throw new Error("socket hang up");
    };
    const result = await saveSessionType("token", TIER, form());
    loud.mockRestore();
    expect(result).toEqual({ ok: false, error: "failed" });
  });
});

describe("it always answers", () => {
  const never = () => new Promise<Answer>(() => {});

  test("a database that never answers is 'no answer in time', within the limit, and nothing more is begun", async () => {
    const loud = spyOn(console, "error").mockImplementation(() => {});
    answer = (table) => (table === "service_tiers" ? never() : undefined);
    const started = Date.now();
    const result = await saveSessionTypeCore(
      "token",
      TIER,
      form({ staffIds: [ANA] }),
      { deadlineMs: 40 },
    );
    loud.mockRestore();
    expect(Date.now() - started).toBeLessThan(1_000);
    // The write was begun and may land: the site is told, to be safe.
    expect(result).toEqual({
      reply: { ok: false, error: "timeout" },
      written: true,
    });
    expect(on("staff_tiers")).toHaveLength(0);
  });

  test("a session check that never answers is the same, and nothing was written", async () => {
    const loud = spyOn(console, "error").mockImplementation(() => {});
    authHangs = true;
    const result = await saveSessionTypeCore("token", TIER, form(), {
      deadlineMs: 40,
    });
    loud.mockRestore();
    expect(result).toEqual({
      reply: { ok: false, error: "timeout" },
      written: false,
    });
    expect(log).toHaveLength(0);
  });

  test("assignments that never answer: the session type was saved, the rest is unknown", async () => {
    const loud = spyOn(console, "error").mockImplementation(() => {});
    answer = (table) => (table === "staff_tiers" ? never() : undefined);
    const result = await saveSessionTypeCore(
      "token",
      TIER,
      form({ staffIds: [ANA] }),
      { deadlineMs: 40 },
    );
    loud.mockRestore();
    expect(result).toEqual({
      reply: { ok: false, error: "timeout" },
      written: true,
    });
  });

  test("the limit is the server's, not an argument of the action", async () => {
    // Every argument of an action comes from the browser.
    expect(saveSessionType.length).toBe(3);
  });
});

describe("nothing else writes a session type", () => {
  const APP = join(import.meta.dir, "..");
  const sources = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return sources(path);
      return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
        ? [path]
        : [];
    });
  const read = (path: string) => readFileSync(join(APP, path), "utf8");

  /** A write to the table: `from("service_tiers")` followed by a mutation. */
  const WRITES =
    /from\(\s*["'`]service_tiers["'`]\s*\)\s*\.(update|insert|upsert|delete)\(/;
  /** The client the browser holds (the public key, or a user's session). */
  const BROWSER_CLIENT = /from\s+["']@\/?lib\/insforge(-public)?["']/;

  const all = sources(APP).map((path) => relative(APP, path));
  const writers = all.filter((path) => WRITES.test(read(path)));

  test("one module writes the table, and it is the server's", () => {
    // If this list grows (a way to create or delete one, a tool that edits
    // prices), the new writer has to be on the server, check who is asking,
    // and tell the site afterwards, as this one does.
    expect(writers).toEqual(["lib/session-types/save.ts"]);
    const source = read(writers[0]!);
    expect(source).not.toMatch(/^\s*["']use client["']/m);
    expect(source).not.toMatch(BROWSER_CLIENT);
    expect(source).toContain("getAdminClient()");
    expect(source).toContain("ADMIN_ROLES");
  });

  test("nothing that runs in the browser, or holds its client, writes it", () => {
    const browser = all.filter((path) => {
      const source = read(path);
      return (
        /^\s*["']use client["']/m.test(source) || BROWSER_CLIENT.test(source)
      );
    });
    expect(browser.length).toBeGreaterThan(50);
    expect(browser.filter((path) => WRITES.test(read(path)))).toEqual([]);
  });

  test("the action tells the site after the write, in the same call", () => {
    const source = read("actions/session-types.ts");
    const write = source.indexOf("saveSessionTypeCore(");
    const refresh = source.indexOf("refreshTierPrices(", write);
    expect(write).toBeGreaterThan(-1);
    expect(refresh).toBeGreaterThan(write);
  });

  test("the form of Settings saves through the action", () => {
    const source = read("components/dashboard/settings/tier-modal.tsx");
    const STAFF_WRITES =
      /from\(\s*["'`]staff_tiers["'`]\s*\)\s*\.(update|insert|upsert|delete)\(/;
    expect({
      callsTheAction: source.includes("saveSessionType("),
      // With a wait that always ends, so it cannot stay on "Saving…".
      waitsWithALimit: /saveWithin\(\s*\(\)\s*=>\s*saveSessionType\(/.test(
        source,
      ),
      writesTheTable: WRITES.test(source),
      // Nor the assignments: they are part of the same save.
      writesTheStaff: STAFF_WRITES.test(source),
    }).toEqual({
      callsTheAction: true,
      waitsWithALimit: true,
      writesTheTable: false,
      writesTheStaff: false,
    });
  });
});
