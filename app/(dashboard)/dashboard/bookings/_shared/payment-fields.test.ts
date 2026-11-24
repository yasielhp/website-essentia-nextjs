import { describe, expect, test } from "bun:test";
import { amountPaidOf, paymentModeFor, paymentValueOf } from "./payment-fields";

/**
 * What the desk writes about the money. Since 2026-11-24 there is no deposit:
 * a booking made or edited at the desk is never given `payment_mode =
 * 'deposit'`, while one made with a deposit before then still loads as partly
 * paid and keeps that state.
 */

describe("paymentModeFor", () => {
  test("never writes a deposit", () => {
    expect(paymentModeFor("pending")).toBe("none");
    expect(paymentModeFor("paid")).toBe("full");
    // Part of the price taken at the counter is a booking paid at the centre
    // with something still owed, not a deposit.
    expect(paymentModeFor("deposit_paid")).toBe("none");
  });
});

describe("a booking made with a deposit before 2026-11-24", () => {
  const row = {
    payment_status: "deposit_paid",
    amount_paid_eur: "65.00",
    balance_settled_method: null,
  };

  test("loads as partly paid, with what was paid", () => {
    const value = paymentValueOf(row);
    expect(value).toEqual({
      status: "deposit_paid",
      amountPaid: "65",
      method: "",
    });
    expect(amountPaidOf(value)).toBe(65);
  });
});
