import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { TIER_PRICES_CACHE_TAG } from "@/lib/treatments/prices";

/**
 * The public site keeps the prices of the session types for five minutes.
 * `refreshTierPrices` is what makes a price changed in Settings show at once,
 * run here for real with Next's cache and the session check replaced. And,
 * read from the source, that everything that writes a session type calls it:
 * a new way of changing a price that forgot to would leave the old one on the
 * site until the five minutes passed.
 *
 * Modules are put back afterwards: `mock.module` is process-wide.
 */

let role: "admin" | "staff" | null = "admin";
let dropped: string[] = [];
let asked: { token: unknown; allowed: unknown }[] = [];
let cacheFails = false;

const real = {
  cache: { ...(await import("next/cache")) },
  guard: { ...(await import("@/lib/auth-guard")) },
};

let refreshTierPrices: typeof import("@/actions/tier-prices").refreshTierPrices;

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
      if (!token || !role) {
        throw new real.guard.AuthError("Authentication required", 401);
      }
      if (!allowed.includes(role)) {
        throw new real.guard.AuthError("Insufficient permissions", 403);
      }
      return { userId: "u1", email: null, verifiedEmail: null, role };
    },
  }));
  ({ refreshTierPrices } = await import("@/actions/tier-prices"));
});

afterAll(() => {
  mock.module("next/cache", () => real.cache);
  mock.module("@/lib/auth-guard", () => real.guard);
});

beforeEach(() => {
  role = "admin";
  dropped = [];
  asked = [];
  cacheFails = false;
});

describe("refreshTierPrices", () => {
  test("an administrator drops the prices the site keeps, so the next visit reads them again", async () => {
    expect(await refreshTierPrices("token")).toEqual({ ok: true });
    expect(dropped).toEqual([TIER_PRICES_CACHE_TAG]);
    expect(TIER_PRICES_CACHE_TAG).toBe("tier-prices");
  });

  test("it is for whoever may change a session type: administrators only", async () => {
    await refreshTierPrices("token");
    expect(asked).toEqual([
      { token: "token", allowed: real.guard.ADMIN_ROLES },
    ]);
  });

  test("nobody else can make the site read its prices again: it is a public endpoint", async () => {
    role = "staff";
    expect(await refreshTierPrices("token")).toEqual({ ok: false });
    role = null;
    expect(await refreshTierPrices("stale")).toEqual({ ok: false });
    expect(await refreshTierPrices(null)).toEqual({ ok: false });
    expect(dropped).toEqual([]);
  });

  test("a cache that cannot be dropped is 'not done', never an exception in the middle of a save", async () => {
    cacheFails = true;
    expect(await refreshTierPrices("token")).toEqual({ ok: false });
  });
});

describe("everything that writes a session type tells the site", () => {
  const APP = join(import.meta.dir, "..");
  const sources = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return sources(path);
      return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
        ? [path]
        : [];
    });

  /** A write to the table: `from("service_tiers")` followed by a mutation. */
  const WRITES =
    /from\(\s*["'`]service_tiers["'`]\s*\)\s*\.(update|insert|upsert|delete)\(/;

  const writers = sources(APP)
    .filter((path) => WRITES.test(readFileSync(path, "utf8")))
    .map((path) => relative(APP, path));

  test("the form of Settings is where a session type is saved, switched on or off", () => {
    // If this list grows (a way to create or delete one, a tool that edits
    // prices), the test below is what the new writer has to satisfy.
    expect(writers).toEqual(["components/dashboard/settings/tier-modal.tsx"]);
  });

  test("and every one of them calls refreshTierPrices after writing", () => {
    for (const writer of writers) {
      const source = readFileSync(join(APP, writer), "utf8");
      const write = source.search(WRITES);
      const refresh = source.indexOf("refreshTierPrices(", write);
      expect(`${writer}: ${refresh > write}`).toBe(`${writer}: true`);
    }
  });
});
