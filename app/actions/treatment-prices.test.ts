import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";

/**
 * The public read behind the price of a treatment card, run for real with the
 * database replaced. What is under test is WHAT it asks the database for (the
 * session types of one service that are on sale, and nothing else of them) and
 * that it never throws at a page: a card without its price is still a card.
 *
 * Modules are put back afterwards: `mock.module` is process-wide.
 */

type Tier = {
  service_id: string;
  active: boolean;
  label: string | null;
  price_eur: number | string | null;
  price_center_eur: number | string | null;
};

let tiers: Tier[] = [];
let failure: "error" | "throw" | null = null;
let reads: { table: string; columns: string }[] = [];

/** The filters are applied to real rows, so one that is missing lets a row through. */
function from(table: string) {
  const filters: [string, unknown][] = [];
  const chain = {
    select(columns: string) {
      reads.push({ table, columns });
      return chain;
    },
    eq(column: string, value: unknown) {
      filters.push([column, value]);
      return chain;
    },
    order() {
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
}

const real = { admin: { ...(await import("@/lib/insforge-admin")) } };

let fetchTreatmentPrices: typeof import("@/actions/treatment-prices").fetchTreatmentPrices;

beforeAll(async () => {
  mock.module("@/lib/insforge-admin", () => ({
    ...real.admin,
    getAdminClient: () => ({ database: { from } }),
  }));
  ({ fetchTreatmentPrices } = await import("@/actions/treatment-prices"));
});

afterAll(() => {
  mock.module("@/lib/insforge-admin", () => real.admin);
});

const tier = (over: Partial<Tier>): Tier => ({
  service_id: "manual-therapies",
  active: true,
  label: "Espira",
  price_eur: "70.00",
  price_center_eur: "70.00",
  ...over,
});

beforeEach(() => {
  tiers = [];
  failure = null;
  reads = [];
});

describe("fetchTreatmentPrices", () => {
  test("the session types of that service that are on sale, each with its price", async () => {
    tiers = [
      tier({}),
      tier({ label: "Pulse", price_eur: 85, price_center_eur: 85 }),
    ];
    expect(await fetchTreatmentPrices("manual-therapies")).toEqual([
      { label: "Espira", priceEur: 70 },
      { label: "Pulse", priceEur: 85 },
    ]);
  });

  test("a session type the centre switched off has no price to show", async () => {
    tiers = [tier({}), tier({ label: "Alure Duo", active: false })];
    expect(await fetchTreatmentPrices("manual-therapies")).toEqual([
      { label: "Espira", priceEur: 70 },
    ]);
  });

  test("another service's session types are not this page's", async () => {
    tiers = [
      tier({}),
      tier({ service_id: "facial-therapies", label: "Aurum" }),
    ];
    expect(await fetchTreatmentPrices("manual-therapies")).toEqual([
      { label: "Espira", priceEur: 70 },
    ]);
  });

  test("only the name and the prices are read: no id, no payment data", async () => {
    tiers = [tier({})];
    await fetchTreatmentPrices("manual-therapies");
    expect(reads).toEqual([
      { table: "service_tiers", columns: "label, price_eur, price_center_eur" },
    ]);
  });

  test("a service the site does not have is refused before anything is read", async () => {
    for (const serviceId of ["", "nope", "manual-therapies,facial", 42, null]) {
      expect(await fetchTreatmentPrices(serviceId as string)).toEqual([]);
    }
    expect(reads).toEqual([]);
  });

  test("a database that fails or throws is no prices, never an error on the page", async () => {
    tiers = [tier({})];
    for (const how of ["error", "throw"] as const) {
      failure = how;
      expect(await fetchTreatmentPrices("manual-therapies")).toEqual([]);
    }
  });
});
