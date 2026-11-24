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
import { fullPaymentCharge } from "@/lib/payments/amounts";

/**
 * The real `readPaymentSettings`, with the database replaced. Whatever goes
 * wrong with the read, the checkout gets NO discount: it never charges less
 * than the centre set, nor a percentage nobody chose.
 */

type Answer = () => { data: unknown; error: unknown };
let answer: Answer = () => ({ data: null, error: null });

function chain(): unknown {
  const proxy: unknown = new Proxy(() => {}, {
    get(_t, prop) {
      if (prop === "then") {
        return (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => {
          try {
            return Promise.resolve(answer()).then(ok, bad);
          } catch (err) {
            return Promise.reject(err).then(ok, bad);
          }
        };
      }
      return () => proxy;
    },
    apply: () => proxy,
  });
  return proxy;
}

const real = { admin: { ...(await import("@/lib/insforge-admin")) } };
let readPaymentSettings: typeof import("./app-settings").readPaymentSettings;

beforeAll(async () => {
  mock.module("@/lib/insforge-admin", () => ({
    getAdminClient: () => ({ database: { from: () => chain() } }),
  }));
  ({ readPaymentSettings } = await import("./app-settings"));
});

afterAll(() => {
  mock.module("@/lib/insforge-admin", () => real.admin);
});

beforeEach(() => {
  answer = () => ({ data: null, error: null });
});

describe("readPaymentSettings", () => {
  test("reads the stored discount", async () => {
    answer = () => ({
      data: { value: { depositPercent: 50, fullPaymentDiscountPercent: 10 } },
      error: null,
    });
    expect(await readPaymentSettings()).toEqual({
      fullPaymentDiscountPercent: 10,
    });
  });

  test("the live row, 0 %, stays 0 %", async () => {
    answer = () => ({
      data: { value: { depositPercent: 50, fullPaymentDiscountPercent: 0 } },
      error: null,
    });
    expect((await readPaymentSettings()).fullPaymentDiscountPercent).toBe(0);
  });

  const failures: [string, Answer][] = [
    ["no row", () => ({ data: null, error: null })],
    ["a malformed row", () => ({ data: { value: { x: 1 } }, error: null })],
    [
      "a read the database refused",
      () => ({ data: null, error: { message: "permission denied" } }),
    ],
    [
      "a read that threw",
      () => {
        throw new Error("network down");
      },
    ],
  ];

  for (const [label, failing] of failures) {
    test(`${label} gives no discount, and the full price is charged`, async () => {
      const quiet = spyOn(console, "error").mockImplementation(() => {});
      answer = failing;
      const settings = await readPaymentSettings();
      quiet.mockRestore();
      expect(settings).toEqual({ fullPaymentDiscountPercent: 0 });
      expect(fullPaymentCharge(130, settings).chargeEur).toBe(130);
    });
  }
});
