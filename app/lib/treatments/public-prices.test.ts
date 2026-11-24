import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import { TIER_PRICES_CACHE_TAG } from "@/lib/treatments/prices";

/**
 * The cached read the pages and the agent tools share, run for real with
 * Next's cache and the database replaced. What is under test is the part that
 * is not the read itself: for how long an answer is kept and under which tag,
 * that a failure is never kept as "no prices", and that it never throws at a
 * page.
 *
 * Both modules are put back afterwards (`mock.module` is process-wide). The
 * anonymous client is built when its module loads and refuses to without the
 * project's address and key, which the tests deliberately do not have. So the
 * real module is loaded once here with stand-ins for the two (an address that
 * resolves nowhere), only to have something real to put back.
 */

type Kept = {
  read: (serviceId: string) => Promise<unknown>;
  keyParts: string[];
  options: { revalidate?: number; tags?: string[] };
};

let kept: Kept | null = null;
/** Every call that reached the cache, by its arguments: each is a cache entry. */
let cached: unknown[][] = [];
let failing = false;
let reads = 0;

const database = {
  from: () => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      order: () => {
        reads += 1;
        return Promise.resolve(
          failing
            ? { data: null, error: { message: "boom" } }
            : {
                data: [
                  {
                    label: "Espira",
                    duration_minutes: 30,
                    price_eur: 70,
                    price_center_eur: 70,
                    active: true,
                  },
                  {
                    label: "Alure Duo",
                    duration_minutes: 50,
                    price_eur: 120,
                    price_center_eur: 120,
                    active: false,
                  },
                ],
                error: null,
              },
        );
      },
    };
    return chain;
  },
};

const ENV = ["NEXT_PUBLIC_INSFORGE_URL", "NEXT_PUBLIC_INSFORGE_ANON_KEY"];
const envBefore = ENV.map((name) => process.env[name]);
process.env.NEXT_PUBLIC_INSFORGE_URL ??= "https://insforge.invalid";
process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY ??= "not-a-key";

const real = {
  cache: { ...(await import("next/cache")) },
  publicClient: { ...(await import("@/lib/insforge-public")) },
};

ENV.forEach((name, i) => {
  if (envBefore[i] === undefined) delete process.env[name];
  else process.env[name] = envBefore[i];
});

let prices: typeof import("@/lib/treatments/public-prices");

beforeAll(async () => {
  mock.module("next/cache", () => ({
    ...real.cache,
    // Keeps nothing: every call reads. What it is asked to keep is recorded.
    unstable_cache: (
      read: Kept["read"],
      keyParts: string[],
      options: Kept["options"],
    ) => {
      kept = { read, keyParts, options };
      return (...args: [string]) => {
        cached.push(args);
        return read(...args);
      };
    },
  }));
  mock.module("@/lib/insforge-public", () => ({
    ...real.publicClient,
    insforgePublic: { database },
  }));
  prices = await import("@/lib/treatments/public-prices");
});

afterAll(() => {
  mock.module("next/cache", () => real.cache);
  mock.module("@/lib/insforge-public", () => real.publicClient);
});

beforeEach(() => {
  failing = false;
  reads = 0;
  cached = [];
});

describe("listPublicTierPrices", () => {
  test("answers with what the read found", async () => {
    expect(await prices.listPublicTierPrices("manual-therapies")).toEqual([
      { label: "Espira", durationMinutes: 30, priceEur: 70 },
    ]);
    expect(reads).toBe(1);
  });

  test("an answer is kept for five minutes, under a tag that can be dropped", () => {
    expect(prices.TIER_PRICES_REVALIDATE_SECONDS).toBe(300);
    expect(kept?.options).toEqual({
      revalidate: prices.TIER_PRICES_REVALIDATE_SECONDS,
      tags: [TIER_PRICES_CACHE_TAG],
    });
    // The second part names the shape kept (prices and the names on sale and
    // switched off), so an entry of the bare list of prices is never read.
    expect(kept?.keyParts).toEqual(["tier-prices", "snapshot"]);
  });

  test("a read that fails is no prices for the page, and never an exception", async () => {
    failing = true;
    expect(await prices.listPublicTierPrices("manual-therapies")).toEqual([]);
  });

  test("and the failure is not what gets kept: inside the cache it is an error, so nothing is stored", async () => {
    failing = true;
    await expect(kept!.read("manual-therapies")).rejects.toThrow();
  });

  test("a service the site does not have reads nothing", async () => {
    expect(await prices.listPublicTierPrices("nope")).toEqual([]);
    expect(reads).toBe(0);
  });

  test("and never reaches the cache: an unknown name must not become an entry of its own", async () => {
    // The argument is part of the cache key, so every distinct string that got
    // this far would be kept as one more entry.
    for (const serviceId of [
      "nope",
      "",
      "manual-therapies ",
      "x".repeat(500),
    ]) {
      expect(await prices.listPublicTierPrices(serviceId)).toEqual([]);
    }
    expect(await prices.listPublicTierPrices(42 as never)).toEqual([]);
    expect(cached).toEqual([]);

    await prices.listPublicTierPrices("manual-therapies");
    await prices.listPublicTierPrices("facial-therapies");
    expect(cached).toEqual([["manual-therapies"], ["facial-therapies"]]);
  });
});

describe("listHiddenTreatments", () => {
  test("a treatment whose session type is switched off is hidden, and the others are not", async () => {
    expect(await prices.listHiddenTreatments("manual-therapies")).toEqual([
      "alure-duo",
    ]);
  });

  test("from the same kept read as the prices: one entry per service", async () => {
    await prices.listPublicTierPrices("manual-therapies");
    await prices.listHiddenTreatments("manual-therapies");
    expect(cached).toEqual([["manual-therapies"], ["manual-therapies"]]);
    expect(kept?.options.tags).toEqual([TIER_PRICES_CACHE_TAG]);
  });

  test("a read that fails hides nothing: every card stays, without a price", async () => {
    failing = true;
    expect(await prices.listHiddenTreatments("manual-therapies")).toEqual([]);
    expect(
      await prices.isTreatmentHidden("manual-therapies", "alure-duo"),
    ).toBe(false);
    expect(await prices.listAllHiddenTreatments()).toEqual({
      "manual-therapies": [],
      "facial-therapies": [],
      "intravenous-therapy": [],
    });
  });

  test("isTreatmentHidden answers for one treatment", async () => {
    expect(
      await prices.isTreatmentHidden("manual-therapies", "alure-duo"),
    ).toBe(true);
    expect(await prices.isTreatmentHidden("manual-therapies", "espira")).toBe(
      false,
    );
  });

  test("listAllHiddenTreatments asks each of the three services", async () => {
    const all = await prices.listAllHiddenTreatments();
    expect(Object.keys(all).sort()).toEqual([
      "facial-therapies",
      "intravenous-therapy",
      "manual-therapies",
    ]);
    expect(cached.map(([serviceId]) => serviceId).sort()).toEqual([
      "facial-therapies",
      "intravenous-therapy",
      "manual-therapies",
    ]);
  });
});
