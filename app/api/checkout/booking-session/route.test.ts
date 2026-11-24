import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import { NextRequest } from "next/server";

/**
 * The real checkout route, with the database replaced and the real Redsys
 * provider on the public test key. Since 2026-11-24 a booking made on the
 * website is paid in full: whatever a page still open on the old form asks for,
 * the bank is sent the whole price and the booking is written as `full`.
 */

const BOOKING = {
  id: "b-1",
  service_id: "manual-therapies",
  status: "pending",
};
const TIER = {
  service_id: "manual-therapies",
  price_eur: 130,
  price_center_eur: 140,
};

/** The live `payments` row: the deposit percent of before is still in it. */
let storedSettings: unknown = {
  depositPercent: 50,
  fullPaymentDiscountPercent: 0,
};
let bookingUpdates: Record<string, unknown>[] = [];

/** A query chain that answers `result` however it is built, and records an UPDATE. */
function chain(table: string): unknown {
  let patch: Record<string, unknown> | null = null;
  const result = () => {
    if (patch) {
      if (table === "bookings") bookingUpdates.push(patch);
      return { data: null, error: null };
    }
    if (table === "bookings") return { data: BOOKING, error: null };
    if (table === "service_tiers") return { data: TIER, error: null };
    if (table === "app_settings") {
      return { data: { value: storedSettings }, error: null };
    }
    return { data: null, error: null };
  };
  const proxy: unknown = new Proxy(() => {}, {
    get(_t, prop) {
      if (prop === "then") {
        return (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) =>
          Promise.resolve(result()).then(ok, bad);
      }
      if (prop === "update") {
        return (p: Record<string, unknown>) => {
          patch = p;
          return proxy;
        };
      }
      return () => proxy;
    },
    apply: () => proxy,
  });
  return proxy;
}

const fakeAdmin = {
  getAdminClient: () => ({
    database: { from: (table: string) => chain(table) },
  }),
};

const real = { admin: { ...(await import("@/lib/insforge-admin")) } };
const ENV = {
  REDSYS_MERCHANT_CODE: process.env.REDSYS_MERCHANT_CODE,
  REDSYS_SECRET_KEY: process.env.REDSYS_SECRET_KEY,
  REDSYS_ENVIRONMENT: process.env.REDSYS_ENVIRONMENT,
};

let POST: (r: NextRequest) => Promise<Response>;

beforeAll(async () => {
  process.env.REDSYS_MERCHANT_CODE = "999008881";
  // Redsys' published key for its test environment, not a secret.
  process.env.REDSYS_SECRET_KEY = "sq7HjrUOBfKmC576ILgskD5srU870gJ7";
  process.env.REDSYS_ENVIRONMENT = "test";
  mock.module("@/lib/insforge-admin", () => fakeAdmin);
  ({ POST } = await import("./route"));
});

afterAll(() => {
  mock.module("@/lib/insforge-admin", () => real.admin);
  for (const [key, value] of Object.entries(ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

beforeEach(() => {
  storedSettings = { depositPercent: 50, fullPaymentDiscountPercent: 0 };
  bookingUpdates = [];
});

async function checkout(body: Record<string, unknown>) {
  const res = await POST(
    new NextRequest("https://app.example.test/api/checkout/booking-session", {
      method: "POST",
      body: JSON.stringify({ bookingId: "b-1", tierId: "t-1", ...body }),
    }),
  );
  const json = (await res.json()) as { Ds_MerchantParameters?: string };
  const sent = json.Ds_MerchantParameters
    ? (JSON.parse(
        Buffer.from(json.Ds_MerchantParameters, "base64").toString("utf8"),
      ) as Record<string, string>)
    : null;
  return { status: res.status, sent };
}

describe("POST /api/checkout/booking-session", () => {
  test("charges the whole online price and writes the booking as paid in full", async () => {
    const { status, sent } = await checkout({ paymentMode: "full" });
    expect(status).toBe(200);
    expect(sent?.DS_MERCHANT_AMOUNT).toBe("13000");
    expect(bookingUpdates).toHaveLength(1);
    expect(bookingUpdates[0]).toMatchObject({
      payment_mode: "full",
      price_eur: 130,
    });
  });

  test("a stale form asking for a deposit is charged the whole price, never a part", async () => {
    const { status, sent } = await checkout({ paymentMode: "deposit" });
    expect(status).toBe(200);
    expect(sent?.DS_MERCHANT_AMOUNT).toBe("13000");
    expect(bookingUpdates[0]).toMatchObject({
      payment_mode: "full",
      price_eur: 130,
    });
  });

  test("a request that says nothing of the mode is charged the whole price too", async () => {
    const { sent } = await checkout({});
    expect(sent?.DS_MERCHANT_AMOUNT).toBe("13000");
    expect(bookingUpdates[0]?.payment_mode).toBe("full");
  });

  test("the online discount of the settings applies to the whole price", async () => {
    storedSettings = { depositPercent: 50, fullPaymentDiscountPercent: 10 };
    const { sent } = await checkout({ paymentMode: "deposit" });
    expect(sent?.DS_MERCHANT_AMOUNT).toBe("11700");
    expect(bookingUpdates[0]).toMatchObject({
      payment_mode: "full",
      price_eur: 117,
    });
  });
});
