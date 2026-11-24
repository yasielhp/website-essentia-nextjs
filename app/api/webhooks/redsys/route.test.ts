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
import crypto from "node:crypto";
import { NextRequest } from "next/server";

/**
 * The real Redsys webhook and the real provider (Redsys' public test key),
 * with the database, the payment handlers and the history replaced. Each
 * notification is signed the way Redsys signs it (3DES of the order with the
 * key, then HMAC-SHA256 of the parameters), so the route verifies it for real.
 *
 * What it pins: a refund or any other operation on a paid order changes
 * nothing, and a refusal never takes a paid booking to `failed`.
 */

const KEY = "sq7HjrUOBfKmC576ILgskD5srU870gJ7";
const ORDER = "790098209516";

function sign(order: string, params: string): string {
  const key = Buffer.from(KEY, "base64");
  const message = Buffer.from(order, "utf8");
  const padded = Buffer.concat([
    message,
    Buffer.alloc((8 - (message.length % 8)) % 8, 0),
  ]);
  const cipher = crypto.createCipheriv("des-ede3-cbc", key, Buffer.alloc(8, 0));
  cipher.setAutoPadding(false);
  const orderKey = Buffer.concat([cipher.update(padded), cipher.final()]);
  return crypto.createHmac("sha256", orderKey).update(params).digest("base64");
}

function notification(fields: Record<string, string>): NextRequest {
  const params = Buffer.from(
    JSON.stringify({
      Ds_Date: "14%2F07%2F2026",
      Ds_Hour: "10%3A00",
      Ds_Amount: "13000",
      Ds_Currency: "978",
      Ds_Order: ORDER,
      Ds_MerchantCode: "999008881",
      Ds_Terminal: "1",
      Ds_SecurePayment: "1",
      ...fields,
    }),
  ).toString("base64");
  const body = new URLSearchParams({
    Ds_SignatureVersion: "HMAC_SHA256_V1",
    Ds_MerchantParameters: params,
    Ds_Signature: sign(fields.Ds_Order ?? ORDER, params),
  }).toString();
  return new NextRequest("https://app.example.test/api/webhooks/redsys", {
    method: "POST",
    body,
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
}

type Write = { table: string; patch: unknown; ops: string[] };

let bookingRow: Record<string, unknown> | null = null;
let bonusRow: Record<string, unknown> | null = null;
let writes: Write[] = [];
let paid: [string, number][] = [];
let bonusPaid: [string, number][] = [];
let recorded: { summary?: string; event?: string }[] = [];

function chain(table: string): unknown {
  const ops: string[] = [];
  let patch: unknown = null;
  const result = () => {
    if (patch !== null) {
      writes.push({ table, patch, ops });
      return { data: [{ id: "x" }], error: null };
    }
    if (table === "bookings") return { data: bookingRow, error: null };
    if (table === "bonus_orders") return { data: bonusRow, error: null };
    return { data: null, error: null };
  };
  const proxy: unknown = new Proxy(() => {}, {
    get(_t, prop) {
      if (prop === "then") {
        return (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) =>
          Promise.resolve(result()).then(ok, bad);
      }
      if (prop === "update") {
        return (p: unknown) => {
          patch = p;
          return proxy;
        };
      }
      return (...args: unknown[]) => {
        ops.push(`${String(prop)}(${JSON.stringify(args)})`);
        return proxy;
      };
    },
    apply: () => proxy,
  });
  return proxy;
}

const real = {
  admin: { ...(await import("@/lib/insforge-admin")) },
  bookingPaid: { ...(await import("@/services/booking-payments.service")) },
  bonusPaid: { ...(await import("@/services/bonus-payments.service")) },
  record: { ...(await import("@/lib/booking-events/record")) },
};
const ENV = {
  REDSYS_MERCHANT_CODE: process.env.REDSYS_MERCHANT_CODE,
  REDSYS_SECRET_KEY: process.env.REDSYS_SECRET_KEY,
  REDSYS_ENVIRONMENT: process.env.REDSYS_ENVIRONMENT,
};

let POST: (r: NextRequest) => Promise<Response>;

beforeAll(async () => {
  process.env.REDSYS_MERCHANT_CODE = "999008881";
  // Redsys' published key for its test environment, not a secret.
  process.env.REDSYS_SECRET_KEY = KEY;
  process.env.REDSYS_ENVIRONMENT = "test";
  mock.module("@/lib/insforge-admin", () => ({
    getAdminClient: () => ({
      database: { from: (table: string) => chain(table) },
    }),
  }));
  mock.module("@/services/booking-payments.service", () => ({
    ...real.bookingPaid,
    handleBookingPaid: async (id: string, cents: number) => {
      paid.push([id, cents]);
    },
  }));
  mock.module("@/services/bonus-payments.service", () => ({
    ...real.bonusPaid,
    handleBonusPaid: async (order: string, cents: number) => {
      bonusPaid.push([order, cents]);
    },
  }));
  mock.module("@/lib/booking-events/record", () => ({
    ...real.record,
    recordBookingEvent: async (e: { summary?: string; event?: string }) => {
      recorded.push(e);
    },
  }));
  ({ POST } = await import("./route"));
});

afterAll(() => {
  mock.module("@/lib/insforge-admin", () => real.admin);
  mock.module("@/services/booking-payments.service", () => real.bookingPaid);
  mock.module("@/services/bonus-payments.service", () => real.bonusPaid);
  mock.module("@/lib/booking-events/record", () => real.record);
  for (const [key, value] of Object.entries(ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

beforeEach(() => {
  bookingRow = { id: "b-1", payment_status: "paid" };
  bonusRow = null;
  writes = [];
  paid = [];
  bonusPaid = [];
  recorded = [];
});

async function post(fields: Record<string, string>) {
  const res = await POST(notification(fields));
  return { status: res.status, body: await res.text() };
}

describe("POST /api/webhooks/redsys", () => {
  test("an authorised payment is handed to handleBookingPaid", async () => {
    bookingRow = { id: "b-1", payment_status: "pending" };
    const res = await post({ Ds_TransactionType: "0", Ds_Response: "0000" });
    expect(res).toEqual({ status: 200, body: "OK" });
    expect(paid).toEqual([["b-1", 13000]]);
    expect(writes).toEqual([]);
  });

  test("a refund of the paid order (type 3, 0900) changes nothing and records no refusal", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    const res = await post({ Ds_TransactionType: "3", Ds_Response: "0900" });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    expect(res).toEqual({ status: 200, body: "OK" });
    expect(writes).toEqual([]);
    expect(recorded).toEqual([]);
    expect(paid).toEqual([]);
  });

  test("a refund notice that does not state its type (0900) is ignored too", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    await post({ Ds_Response: "0900" });
    warn.mockRestore();
    expect(writes).toEqual([]);
    expect(recorded).toEqual([]);
  });

  test("a cancellation (0400) and a refund Redsys refused (0950) are ignored", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    await post({ Ds_TransactionType: "Q", Ds_Response: "0400" });
    await post({ Ds_TransactionType: "3", Ds_Response: "0950" });
    warn.mockRestore();
    expect(writes).toEqual([]);
    expect(recorded).toEqual([]);
  });

  test("a refused payment on an unpaid booking marks it failed and says so", async () => {
    bookingRow = { id: "b-1", payment_status: "pending" };
    await post({ Ds_TransactionType: "0", Ds_Response: "0190" });
    expect(writes).toHaveLength(1);
    expect(writes[0]!.table).toBe("bookings");
    expect(writes[0]!.patch).toEqual({ payment_status: "failed" });
    // Conditioned on the booking still having no money.
    expect(writes[0]!.ops.some((op) => op.startsWith("in("))).toBe(true);
    expect(recorded[0]?.summary).toBe("Pago rechazado por Redsys");
  });

  for (const status of ["paid", "deposit_paid", "refunded"]) {
    test(`a refusal never touches a booking that is ${status}`, async () => {
      bookingRow = { id: "b-1", payment_status: status };
      const warn = spyOn(console, "warn").mockImplementation(() => {});
      await post({ Ds_TransactionType: "0", Ds_Response: "0190" });
      warn.mockRestore();
      expect(writes).toEqual([]);
      expect(recorded).toEqual([]);
    });
  }

  test("a refund of a paid bonus changes nothing", async () => {
    bookingRow = null;
    bonusRow = { id: "o-1" };
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    await post({
      Ds_Order: "1234B5678901",
      Ds_TransactionType: "3",
      Ds_Response: "0900",
    });
    warn.mockRestore();
    expect(bonusPaid).toEqual([]);
    expect(writes).toEqual([]);
  });

  test("a notification with a forged signature is refused", async () => {
    const req = notification({ Ds_TransactionType: "0", Ds_Response: "0000" });
    const body = new URLSearchParams(await req.text());
    body.set("Ds_Signature", sign("000000000000", "x"));
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(
      new NextRequest("https://app.example.test/api/webhooks/redsys", {
        method: "POST",
        body: body.toString(),
      }),
    );
    quiet.mockRestore();
    expect(await res.text()).toBe("KO");
    expect(paid).toEqual([]);
  });
});
