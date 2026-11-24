import { describe, expect, it } from "bun:test";
import { holdsMoney } from "./checkout-order";

describe("holdsMoney", () => {
  it("is true for a booking paid, part paid or refunded", () => {
    for (const payment_status of ["paid", "deposit_paid", "refunded"]) {
      expect(holdsMoney({ payment_status, amount_paid_eur: 0 })).toBe(true);
    }
  });

  it("is true for any money taken, whatever the state says", () => {
    expect(
      holdsMoney({ payment_status: "pending", amount_paid_eur: "10.00" }),
    ).toBe(true);
  });

  it("is false for a booking with nothing paid, or a payment refused", () => {
    expect(holdsMoney({ payment_status: "pending", amount_paid_eur: 0 })).toBe(
      false,
    );
    expect(
      holdsMoney({ payment_status: "failed", amount_paid_eur: null }),
    ).toBe(false);
  });
});
