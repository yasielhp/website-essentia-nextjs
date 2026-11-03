import { describe, expect, it } from "bun:test";
import {
  chargeForMode,
  paymentStatusAfter,
  amountOwed,
  effectivePayment,
  type PaymentSettings,
} from "./amounts";

const settings: PaymentSettings = {
  depositPercent: 50,
  fullPaymentDiscountPercent: 5,
  requirePayment: true,
};

describe("chargeForMode", () => {
  it("deposit charges the deposit percent of the list price, rounded to cents", () => {
    expect(chargeForMode(100, "deposit", settings)).toEqual({
      chargeEur: 50,
      finalPriceEur: 100,
    });
    expect(chargeForMode(99.99, "deposit", settings)).toEqual({
      chargeEur: 50,
      finalPriceEur: 99.99,
    });
  });

  it("full charges the discounted price and records it as the final price", () => {
    expect(chargeForMode(100, "full", settings)).toEqual({
      chargeEur: 95,
      finalPriceEur: 95,
    });
  });

  it("full with no discount charges the list price", () => {
    expect(
      chargeForMode(100, "full", {
        ...settings,
        fullPaymentDiscountPercent: 0,
      }),
    ).toEqual({ chargeEur: 100, finalPriceEur: 100 });
  });

  it("refuses a non-positive price", () => {
    expect(() => chargeForMode(0, "deposit", settings)).toThrow();
  });
});

describe("paymentStatusAfter", () => {
  it("is paid when the money covers the price", () => {
    expect(paymentStatusAfter(95, 95)).toBe("paid");
    expect(paymentStatusAfter(100, 95)).toBe("paid");
  });
  it("is deposit_paid when something but not all came in", () => {
    expect(paymentStatusAfter(50, 100)).toBe("deposit_paid");
  });
  it("is pending when nothing came in", () => {
    expect(paymentStatusAfter(0, 100)).toBe("pending");
  });
});

describe("amountOwed", () => {
  it("never goes negative", () => {
    expect(amountOwed(100, 50)).toBe(50);
    expect(amountOwed(95, 100)).toBe(0);
    expect(amountOwed(null, 0)).toBe(0);
  });
});

describe("effectivePayment", () => {
  const base = {
    status: "confirmed",
    payment_status: "pending",
    payment_mode: null,
    price_eur: 130,
    amount_paid_eur: 0,
  };

  it("reads an old confirmed booking as paid at its price", () => {
    expect(effectivePayment(base)).toEqual({
      status: "paid",
      paidEur: 130,
      owedEur: 0,
    });
  });
  it("leaves an old booking that failed or was refunded alone", () => {
    expect(effectivePayment({ ...base, payment_status: "failed" }).status).toBe(
      "failed",
    );
  });
  it("leaves an old unconfirmed booking pending", () => {
    expect(effectivePayment({ ...base, status: "pending" }).status).toBe(
      "pending",
    );
  });
  it("trusts the columns on a booking made with deposits", () => {
    expect(
      effectivePayment({
        ...base,
        payment_mode: "deposit",
        payment_status: "deposit_paid",
        amount_paid_eur: 65,
      }),
    ).toEqual({ status: "deposit_paid", paidEur: 65, owedEur: 65 });
  });
  it("owes nothing on a bonus or a cancelled booking", () => {
    expect(effectivePayment({ ...base, payment_mode: "bonus" }).owedEur).toBe(
      0,
    );
    expect(
      effectivePayment({
        ...base,
        payment_mode: "deposit",
        status: "cancelled",
      }).owedEur,
    ).toBe(0);
  });
});
