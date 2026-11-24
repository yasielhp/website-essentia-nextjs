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
  payment_status: "pending",
  amount_paid_eur: 0,
  stripe_session_id: null as string | null,
};
let booking: typeof BOOKING = { ...BOOKING };
/** When true, the conditional write matches nothing: paid in between. */
let writeRefused = false;
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
/** Rows inserted into `booking_events` (the order written to the history). */
let inserts: Record<string, unknown>[] = [];
/** When set, the `app_settings` read is refused by the database. */
let settingsRefused = false;

/** A query chain that answers `result` however it is built, and records an UPDATE. */
function chain(table: string): unknown {
  let patch: Record<string, unknown> | null = null;
  const result = () => {
    if (patch) {
      if (table === "bookings") bookingUpdates.push(patch);
      return { data: writeRefused ? [] : [{ id: "b-1" }], error: null };
    }
    if (table === "bookings") return { data: booking, error: null };
    if (table === "service_tiers") return { data: TIER, error: null };
    if (table === "app_settings") {
      return settingsRefused
        ? { data: null, error: { message: "permission denied" } }
        : { data: { value: storedSettings }, error: null };
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
      if (prop === "insert") {
        return (rows: Record<string, unknown>[]) => {
          if (table === "booking_events") inserts.push(...rows);
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
  settingsRefused = false;
  booking = { ...BOOKING };
  writeRefused = false;
  inserts = [];
});

async function checkout(body: Record<string, unknown>) {
  const res = await POST(
    new NextRequest("https://app.example.test/api/checkout/booking-session", {
      method: "POST",
      body: JSON.stringify({ bookingId: "b-1", tierId: "t-1", ...body }),
    }),
  );
  const json = (await res.json()) as {
    Ds_MerchantParameters?: string;
    orderId?: string;
  };
  const sent = json.Ds_MerchantParameters
    ? (JSON.parse(
        Buffer.from(json.Ds_MerchantParameters, "base64").toString("utf8"),
      ) as Record<string, string>)
    : null;
  return { status: res.status, sent, orderId: json.orderId ?? null };
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

  test("settings that cannot be read give no discount: the whole price, never 5 % off", async () => {
    settingsRefused = true;
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    const { sent } = await checkout({});
    quiet.mockRestore();
    expect(sent?.DS_MERCHANT_AMOUNT).toBe("13000");
    expect(bookingUpdates[0]).toMatchObject({ price_eur: 130 });
  });

  test("a malformed settings row gives no discount either", async () => {
    storedSettings = { fullPaymentDiscountPercent: "cinco" };
    const { sent } = await checkout({});
    expect(sent?.DS_MERCHANT_AMOUNT).toBe("13000");
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

describe("never charged twice", () => {
  for (const [label, state] of [
    ["paid", { payment_status: "paid", amount_paid_eur: 130 }],
    [
      "part paid before deposits ended",
      { payment_status: "deposit_paid", amount_paid_eur: 65 },
    ],
    ["refunded", { payment_status: "refunded", amount_paid_eur: 130 }],
    [
      "holding money under any state",
      { payment_status: "pending", amount_paid_eur: 10 },
    ],
  ] as const) {
    test(`a booking ${label} opens no checkout, says so, and keeps its order`, async () => {
      booking = { ...booking, ...state, stripe_session_id: "790098209516" };
      const res = await POST(
        new NextRequest(
          "https://app.example.test/api/checkout/booking-session",
          {
            method: "POST",
            body: JSON.stringify({ bookingId: "b-1", tierId: "t-1" }),
          },
        ),
      );
      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({ code: "already_paid" });
      expect(bookingUpdates).toEqual([]);
      expect(inserts).toEqual([]);
    });
  }

  test("every checkout opens a new order and writes it to the history", async () => {
    booking = { ...booking, stripe_session_id: "790098209516" };
    const { status, orderId } = await checkout({});
    expect(status).toBe(200);
    expect(orderId).not.toBe("790098209516");
    expect(bookingUpdates[0]?.stripe_session_id).toBe(orderId);
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      booking_id: "b-1",
      channel: "payment",
      event: "checkout",
      provider_id: orderId,
    });
  });

  test("paid between the read and the write: refused, and the client is not sent to the bank", async () => {
    writeRefused = true;
    const { status } = await checkout({});
    expect(status).toBe(409);
    expect(inserts).toEqual([]);
  });
});
