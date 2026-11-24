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
  /**
   * Read from the SOURCE: the app, the scripts, `i18n/` and the files at the
   * root of the repository (`proxy.ts`, the instrumentation, the configs).
   *
   * Three tables are watched, because they stand or fall together:
   * `service_tiers` (the prices), `staff_tiers` (who performs each one, saved
   * in the same call) and `service_settings` (the services: deleting one takes
   * its session types with it, through the foreign key, whatever the session
   * types' own protection says).
   *
   * THIS IS A REMINDER, NOT THE BARRIER. Being text, it cannot see a table
   * name put together at run time (a template literal, a value that arrives
   * from somewhere else), nor what a function of the database does once it is
   * called with `.rpc(`: it only holds those functions to a list somebody has
   * read (below). The barrier is the row level security of
   * `insforge/migrations/20261124_service_tiers_and_settings_rls.sql`, which
   * leaves the browser roles nothing but reads whatever the code says.
   */
  const ROOT = join(import.meta.dir, "..", "..");
  const isSource = (name: string) =>
    /\.tsx?$/.test(name) &&
    !/\.test\.tsx?$/.test(name) &&
    !/\.d\.ts$/.test(name) &&
    // Somebody's scratch file (`.wa-*.tmp.ts`) is not the app.
    !name.startsWith(".");
  const under = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return under(path);
      return isSource(entry.name) ? [path] : [];
    });
  const all = [
    ...under(join(ROOT, "app")),
    ...under(join(ROOT, "scripts")),
    ...under(join(ROOT, "i18n")),
    ...readdirSync(ROOT, { withFileTypes: true })
      .filter((entry) => entry.isFile() && isSource(entry.name))
      .map((entry) => join(ROOT, entry.name)),
  ]
    .map((path) => relative(ROOT, path))
    .sort();
  const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

  const SAVE = "app/lib/session-types/save.ts";
  /** Each table and the only modules that may write it. */
  const WRITERS: Record<string, string[]> = {
    service_tiers: [SAVE],
    staff_tiers: [SAVE],
    // Nothing writes a service: its name and whether it is offered are set in
    // the database. A screen for it needs its own server action first.
    service_settings: [],
  };
  const TABLES = Object.keys(WRITERS);
  const named = (table: string) => `["'\`]${table}["'\`]`;
  /**
   * `from(table)` that does not go straight on to `.select(`: an update, an
   * insert, an upsert, a delete, or a builder kept in a variable, which could
   * be any of them a line later. Stricter than looking for the four verbs.
   */
  const notARead = (table: string) =>
    new RegExp(`from\\(\\s*${named(table)}\\s*\\)(?!\\s*\\.select\\()`);
  /**
   * The table's name given to a variable, a property or a default, to be
   * handed to `from(` under another name (`const T = "service_tiers"`).
   */
  const aliased = (table: string) =>
    new RegExp(
      `(?<![=!<>])=\\s*${named(table)}|[\\w$\\]?]\\s*:\\s*${named(table)}`,
    );
  /** The client the browser holds (the public key, or a user's session). */
  const BROWSER_CLIENT = /from\s+["']@\/?lib\/insforge(-public)?["']/;

  test("it reads the app, the scripts and the root, tests and scratch files aside", () => {
    expect(all).toContain("proxy.ts");
    expect(all).toContain("scripts/build-llms.ts");
    expect(all).toContain("i18n/request.ts");
    expect(all).toContain(SAVE);
    expect(all.some((path) => path.includes(".test."))).toBe(false);
    expect(all.length).toBeGreaterThan(500);
  });

  test.each(TABLES)(
    "%s is written by the server's own module and by nothing else",
    (table) => {
      // If a list grows (a way to create or delete one, a tool that edits
      // prices), the new writer has to be on the server, check who is asking,
      // and tell the site afterwards, as this one does.
      const writers = all.filter((path) => notARead(table).test(read(path)));
      expect(writers).toEqual(WRITERS[table]!);
    },
  );

  test("the module that writes them is the server's: service key, administrators, no browser client", () => {
    const source = read(SAVE);
    expect({
      client: /^\s*["']use client["']/m.test(source),
      browserClient: BROWSER_CLIENT.test(source),
      serviceKey: source.includes("getAdminClient()"),
      administrators: source.includes("requireRole(accessToken, ADMIN_ROLES)"),
    }).toEqual({
      client: false,
      browserClient: false,
      serviceKey: true,
      administrators: true,
    });
  });

  test("nothing that runs in the browser, or holds its client, writes any of them", () => {
    const browser = all.filter((path) => {
      const source = read(path);
      return (
        /^\s*["']use client["']/m.test(source) || BROWSER_CLIENT.test(source)
      );
    });
    expect(browser.length).toBeGreaterThan(50);
    expect(
      browser.filter((path) =>
        TABLES.some((table) => notARead(table).test(read(path))),
      ),
    ).toEqual([]);
  });

  test("none of them goes under another name", () => {
    expect(
      all.filter((path) =>
        TABLES.some((table) => aliased(table).test(read(path))),
      ),
    ).toEqual([]);
    // The check itself: what it is there to catch, and what it must let be.
    expect(aliased("service_tiers").test('const T = "service_tiers";')).toBe(
      true,
    );
    expect(aliased("service_tiers").test("{ table: 'service_tiers' }")).toBe(
      true,
    );
    expect(
      aliased("service_tiers").test('db.from("service_tiers").select("id")'),
    ).toBe(false);
    expect(aliased("service_tiers").test('Pick<Row, "service_tiers">')).toBe(
      false,
    );
    expect(
      notARead("service_tiers").test('const q = db.from("service_tiers");'),
    ).toBe(true);
    expect(
      notARead("service_tiers").test(
        'db\n  .from("service_tiers")\n  .select("id")',
      ),
    ).toBe(false);
  });

  /**
   * The functions of the database the code calls, by name. Each was read in
   * `pg_proc` on 2026-11-24: no function of the database (these, or any they
   * call) mentions `service_tiers`, `staff_tiers` or `service_settings`. Their
   * SQL is not in this repository, so a function NEW to the code fails here
   * until somebody has read its body in the database and added it to this
   * list:
   *
   *   SELECT proname, prosecdef, prosrc FROM pg_proc WHERE proname = '<name>';
   *
   * A `SECURITY DEFINER` function is not held back by row level security:
   * one that writes these tables is a writer like any other, and has to check
   * who is calling.
   */
  const READ_FUNCTIONS = [
    "admin_set_user_password",
    "check_email_role",
    "create_draft_booking",
    "promote_contact_to_client",
    "record_campaign_event",
    "register_for_education",
    "register_for_race",
    "update_booking_datetime",
    "update_booking_returning_previous",
    "upsert_contact",
  ];
  /** `.rpc(` and its first argument when it is a plain name in quotes. */
  const RPC = /\.rpc\(\s*(?:["'`](\w+)["'`](?=\s*[,)]))?/g;

  test("every function of the database it calls has been read, and is named in the call", () => {
    const unread = new Set<string>();
    const unnamed = new Set<string>();
    for (const path of all) {
      for (const [, name] of read(path).matchAll(RPC)) {
        if (!name) unnamed.add(path);
        else if (!READ_FUNCTIONS.includes(name)) unread.add(`${path}: ${name}`);
      }
    }
    // A name kept in a variable, or put together, cannot be held to the list.
    expect({ unread: [...unread], unnamed: [...unnamed] }).toEqual({
      unread: [],
      unnamed: [],
    });
    // The check itself.
    const names = (code: string) =>
      [...code.matchAll(RPC)].map((m): string | null => m[1] ?? null);
    expect(names('db.rpc(\n  "upsert_contact",\n  { p: 1 },\n)')).toEqual([
      "upsert_contact",
    ]);
    expect(names("db.rpc(FN, {})")).toEqual([null]);
    expect(names("db.rpc(`fn_${kind}`, {})")).toEqual([null]);
  });

  test("the action tells the site after the write, in the same call", () => {
    const source = read("app/actions/session-types.ts");
    const write = source.indexOf("saveSessionTypeCore(");
    const refresh = source.indexOf("refreshTierPrices(", write);
    expect(write).toBeGreaterThan(-1);
    expect(refresh).toBeGreaterThan(write);
  });

  test("the form of Settings saves through the action", () => {
    const source = read("app/components/dashboard/settings/tier-modal.tsx");
    expect({
      callsTheAction: source.includes("saveSessionType("),
      // With a wait that always ends, so it cannot stay on "Saving…".
      waitsWithALimit: /saveWithin\(\s*\(\)\s*=>\s*saveSessionType\(/.test(
        source,
      ),
      // A save that landed, or may have, shows in the list behind the modal
      // even when the modal stays open with its notice.
      refreshesAfterAPartialSave:
        /mayHaveSaved\(result\.error\)[\s\S]{0,120}onRefresh\(/.test(source),
    }).toEqual({
      callsTheAction: true,
      waitsWithALimit: true,
      refreshesAfterAPartialSave: true,
    });
  });
});

describe("the migration that closes the tables", () => {
  const FILE = join(
    import.meta.dir,
    "..",
    "..",
    "insforge",
    "migrations",
    "20261124_service_tiers_and_settings_rls.sql",
  );
  const file = readFileSync(FILE, "utf8");
  /** What the CLI is sent: no comment lines, no BEGIN or COMMIT. */
  const sql = file
    .split("\n")
    .filter((line) => !line.startsWith("--") && !/^(BEGIN|COMMIT);$/.test(line))
    .join("\n")
    .trim();

  test("it says it is not applied, and what is sent does not open with a comment", () => {
    expect(file.startsWith("-- NOT APPLIED")).toBe(true);
    expect(sql.startsWith("--")).toBe(false);
    expect(sql.startsWith("ALTER TABLE")).toBe(true);
  });

  // In ONE file, so the two cannot be applied apart: with the session types
  // closed and the services open, deleting a service still deletes its
  // session types (ON DELETE CASCADE), whoever holds the public key.
  test.each(["service_tiers", "service_settings"])(
    "%s: row level security on, and the browser roles lose their writes",
    (table) => {
      expect(sql).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
      expect(sql).toContain(
        `REVOKE INSERT, UPDATE, DELETE ON ${table} FROM anon, authenticated;`,
      );
    },
  );

  test("every policy is a read: four of them, and none for a write", () => {
    const policies = [...sql.matchAll(/CREATE POLICY[^;]+;/g)].map(
      (match) => match[0],
    );
    expect(policies).toHaveLength(4);
    for (const policy of policies) {
      expect(/\bFOR SELECT\b/.test(policy)).toBe(true);
      expect(/\bFOR (ALL|INSERT|UPDATE|DELETE)\b/.test(policy)).toBe(false);
    }
    // The public reads what is on offer; the team reads everything.
    expect(policies.filter((p) => /USING \(active\)/.test(p))).toHaveLength(2);
    expect(
      policies.filter((p) => p.includes("'admin', 'staff', 'partner'")),
    ).toHaveLength(2);
  });

  test("it can be run again: every policy is dropped before it is made", () => {
    const made = [...sql.matchAll(/CREATE POLICY ("[^"]+") ON (\w+)/g)];
    for (const [, name, table] of made) {
      const drop = sql.indexOf(`DROP POLICY IF EXISTS ${name} ON ${table};`);
      expect(drop).toBeGreaterThan(-1);
      expect(drop).toBeLessThan(sql.indexOf(`CREATE POLICY ${name}`));
    }
  });
});
