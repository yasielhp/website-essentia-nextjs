import { describe, expect, test } from "bun:test";
import { readTierSnapshot } from "@/lib/treatments/read-prices";

/**
 * The read behind every price the public site and the agent tools show, and
 * behind which treatments the site hides. What is under test is WHAT it asks
 * the database for (the session types of one service, on sale or switched off,
 * and nothing else of them), and that a database it cannot read is an error
 * for the caller to handle, not a list of no prices: "there are none" and
 * "could not ask" must not be kept as the same answer.
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
const NOTHING = { prices: [], onSale: [], switchedOff: [] };

describe("readTierSnapshot", () => {
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
    expect(await readTierSnapshot(db, "manual-therapies")).toEqual({
      prices: [ESPIRA, { label: "Pulse", durationMinutes: 45, priceEur: 85 }],
      onSale: ["Espira", "Pulse"],
      switchedOff: [],
    });
  });

  test("a session type the centre switched off has no price to show, and is named as switched off", async () => {
    const { db } = fakeDb([
      tier({}),
      tier({ label: "Alure Duo", active: false }),
    ]);
    expect(await readTierSnapshot(db, "manual-therapies")).toEqual({
      prices: [ESPIRA],
      onSale: ["Espira"],
      switchedOff: ["Alure Duo"],
    });
  });

  test("one on sale with no price is still on sale: it is not priced, and not hidden", async () => {
    const { db } = fakeDb([
      tier({ label: "Lume", price_eur: null, price_center_eur: null }),
    ]);
    expect(await readTierSnapshot(db, "manual-therapies")).toEqual({
      prices: [],
      onSale: ["Lume"],
      switchedOff: [],
    });
  });

  test("another service's session types are not this one's", async () => {
    const { db } = fakeDb([
      tier({}),
      tier({ service_id: "facial-therapies", label: "Aurum" }),
      tier({ service_id: "facial-therapies", label: "Kinéa", active: false }),
    ]);
    expect(await readTierSnapshot(db, "manual-therapies")).toEqual({
      prices: [ESPIRA],
      onSale: ["Espira"],
      switchedOff: [],
    });
  });

  test("only the name, the length, the prices and whether it is on sale are read, in the order the centre gave them", async () => {
    const { db, reads } = fakeDb([tier({})]);
    await readTierSnapshot(db, "manual-therapies");
    expect(reads).toEqual([
      {
        table: "service_tiers",
        columns: "label, duration_minutes, price_eur, price_center_eur, active",
        order: "sort_order",
      },
    ]);
  });

  test("a service the site does not have is nothing, and nothing is read", async () => {
    const { db, reads } = fakeDb([tier({})]);
    for (const serviceId of ["", "nope", "manual-therapies,facial", 42, null]) {
      expect(await readTierSnapshot(db, serviceId)).toEqual(NOTHING);
    }
    expect(reads).toEqual([]);
  });

  test("a database that fails or throws is an error, not an empty list", async () => {
    for (const how of ["error", "throw"] as const) {
      const { db } = fakeDb([tier({})], how);
      await expect(readTierSnapshot(db, "manual-therapies")).rejects.toThrow();
    }
  });

  test("and the error does not carry the database's own text", async () => {
    const { db } = fakeDb([tier({})], "error");
    const error = await readTierSnapshot(db, "manual-therapies").catch(
      (e: unknown) => e,
    );
    expect(String(error)).not.toContain("boom");
  });
});
