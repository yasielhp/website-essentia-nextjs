import { describe, expect, test } from "bun:test";
import { readTierPrices } from "@/lib/treatments/read-prices";

/**
 * The read behind every price the public site and the agent tools show. What is
 * under test is WHAT it asks the database for (the session types of one service
 * that are on sale, and nothing else of them), and that a database it cannot
 * read is an error for the caller to handle, not a list of no prices: "there
 * are none" and "could not ask" must not be kept as the same answer.
 */

type Tier = {
  service_id: string;
  active: boolean;
  label: string | null;
  duration_minutes: number | null;
  price_eur: number | string | null;
  price_center_eur: number | string | null;
};

function fakeDb(tiers: Tier[], failure: "error" | "throw" | null = null) {
  const reads: { table: string; columns: string; order: string }[] = [];
  const db = {
    /** The filters are applied to real rows, so one that is missing lets a row through. */
    from(table: string) {
      const filters: [string, unknown][] = [];
      let columns = "";
      const chain = {
        select(wanted: string) {
          columns = wanted;
          return chain;
        },
        eq(column: string, value: unknown) {
          filters.push([column, value]);
          return chain;
        },
        order(by: string) {
          reads.push({ table, columns, order: by });
          if (failure === "throw") return Promise.reject(new Error("boom"));
          if (failure === "error") {
            return Promise.resolve({ data: null, error: { message: "boom" } });
          }
          return Promise.resolve({
            data: tiers.filter((tier) =>
              filters.every(
                ([column, value]) =>
                  (tier as Record<string, unknown>)[column] === value,
              ),
            ),
            error: null,
          });
        },
      };
      return chain;
    },
  };
  return { db: db as never, reads };
}

const tier = (over: Partial<Tier>): Tier => ({
  service_id: "manual-therapies",
  active: true,
  label: "Espira",
  duration_minutes: 30,
  price_eur: "70.00",
  price_center_eur: "70.00",
  ...over,
});

const ESPIRA = { label: "Espira", durationMinutes: 30, priceEur: 70 };

describe("readTierPrices", () => {
  test("the session types of that service that are on sale, each with its length and price", async () => {
    const { db } = fakeDb([
      tier({}),
      tier({
        label: "Pulse",
        duration_minutes: 45,
        price_eur: 85,
        price_center_eur: 85,
      }),
    ]);
    expect(await readTierPrices(db, "manual-therapies")).toEqual([
      ESPIRA,
      { label: "Pulse", durationMinutes: 45, priceEur: 85 },
    ]);
  });

  test("a session type the centre switched off has no price to show", async () => {
    const { db } = fakeDb([
      tier({}),
      tier({ label: "Alure Duo", active: false }),
    ]);
    expect(await readTierPrices(db, "manual-therapies")).toEqual([ESPIRA]);
  });

  test("another service's session types are not this one's", async () => {
    const { db } = fakeDb([
      tier({}),
      tier({ service_id: "facial-therapies", label: "Aurum" }),
    ]);
    expect(await readTierPrices(db, "manual-therapies")).toEqual([ESPIRA]);
  });

  test("only the name, the length and the prices are read, in the order the centre gave them", async () => {
    const { db, reads } = fakeDb([tier({})]);
    await readTierPrices(db, "manual-therapies");
    expect(reads).toEqual([
      {
        table: "service_tiers",
        columns: "label, duration_minutes, price_eur, price_center_eur",
        order: "sort_order",
      },
    ]);
  });

  test("a service the site does not have is no prices, and nothing is read", async () => {
    const { db, reads } = fakeDb([tier({})]);
    for (const serviceId of ["", "nope", "manual-therapies,facial", 42, null]) {
      expect(await readTierPrices(db, serviceId)).toEqual([]);
    }
    expect(reads).toEqual([]);
  });

  test("a database that fails or throws is an error, not an empty list", async () => {
    for (const how of ["error", "throw"] as const) {
      const { db } = fakeDb([tier({})], how);
      await expect(readTierPrices(db, "manual-therapies")).rejects.toThrow();
    }
  });

  test("and the error does not carry the database's own text", async () => {
    const { db } = fakeDb([tier({})], "error");
    const error = await readTierPrices(db, "manual-therapies").catch(
      (e: unknown) => e,
    );
    expect(String(error)).not.toContain("boom");
  });
});
