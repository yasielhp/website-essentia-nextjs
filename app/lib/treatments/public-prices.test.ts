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
 * `next/cache` is put back afterwards (`mock.module` is process-wide). The
 * anonymous client is not: it cannot be loaded without the project's keys,
 * which the tests deliberately do not have, so there is no real module to keep.
 */

type Kept = {
  read: (serviceId: string) => Promise<unknown>;
  keyParts: string[];
  options: { revalidate?: number; tags?: string[] };
};

let kept: Kept | null = null;
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

const real = { cache: { ...(await import("next/cache")) } };

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
      return read;
    },
  }));
  mock.module("@/lib/insforge-public", () => ({
    insforgePublic: { database },
  }));
  prices = await import("@/lib/treatments/public-prices");
});

afterAll(() => {
  mock.module("next/cache", () => real.cache);
});

beforeEach(() => {
  failing = false;
  reads = 0;
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
    expect(kept?.keyParts).toEqual(["tier-prices"]);
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
});
