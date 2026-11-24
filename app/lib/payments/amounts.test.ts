import { describe, expect, it } from "bun:test";
import * as amounts from "./amounts";
import {
  fullPaymentCharge,
  paymentStatusAfter,
  amountOwed,
  effectivePayment,
  type PaymentSettings,
} from "./amounts";
import { paymentSettingsSchema } from "@/lib/schemas";

const settings: PaymentSettings = {
  fullPaymentDiscountPercent: 5,
};

describe("fullPaymentCharge", () => {
  it("charges the discounted price and records it as the final price", () => {
    expect(fullPaymentCharge(100, settings)).toEqual({
      chargeEur: 95,
      finalPriceEur: 95,
    });
  });

  it("with no discount charges the list price, to the cent", () => {
    expect(fullPaymentCharge(99.99, { fullPaymentDiscountPercent: 0 })).toEqual(
      { chargeEur: 99.99, finalPriceEur: 99.99 },
    );
  });

  it("never leaves anything to pay at the centre", () => {
    for (const price of [30, 45.5, 99.99, 130]) {
      for (const discount of [0, 5, 10]) {
        const { chargeEur, finalPriceEur } = fullPaymentCharge(price, {
          fullPaymentDiscountPercent: discount,
        });
        expect(amountOwed(finalPriceEur, chargeEur)).toBe(0);
        expect(paymentStatusAfter(chargeEur, finalPriceEur)).toBe("paid");
      }
    }
  });

  it("refuses a non-positive price", () => {
    expect(() => fullPaymentCharge(0, settings)).toThrow();
  });

  it("is the only charge there is: nothing computes a deposit", () => {
    // Since 2026-11-24 a new booking is paid in full or not online at all.
    expect(
      Object.keys(amounts).filter((name) => /deposit|mode/i.test(name)),
    ).toEqual([]);
    expect(Object.keys(amounts.DEFAULT_PAYMENT_SETTINGS)).toEqual([
      "fullPaymentDiscountPercent",
    ]);
  });
});

describe("the stored payment settings", () => {
  it("still parse with the deposit percent of before, which is dropped", () => {
    // The live `payments` row, untouched since the deposit days.
    const parsed = paymentSettingsSchema.safeParse({
      depositPercent: 50,
      fullPaymentDiscountPercent: 0,
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({ fullPaymentDiscountPercent: 0 });
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

describe("a booking made with a deposit before 2026-11-24", () => {
  // Price 130, 65 paid online: the rows the deposit days left behind.
  const old = {
    status: "confirmed",
    payment_status: "deposit_paid",
    payment_mode: "deposit",
    price_eur: "130.00",
    amount_paid_eur: "65.00",
  };

  it("still reads as partly paid, with the balance owed at the centre", () => {
    expect(effectivePayment(old)).toEqual({
      status: "deposit_paid",
      paidEur: 65,
      owedEur: 65,
    });
  });

  it("is settled by the balance taken at the counter", () => {
    const paid = 65 + 65;
    expect(paymentStatusAfter(paid, 130)).toBe("paid");
    expect(amountOwed(130, paid)).toBe(0);
    expect(
      effectivePayment({
        ...old,
        payment_status: "paid",
        amount_paid_eur: paid,
      }),
    ).toEqual({ status: "paid", paidEur: 130, owedEur: 0 });
  });

  it("stays partly paid after a smaller sum at the counter", () => {
    expect(paymentStatusAfter(65 + 20, 130)).toBe("deposit_paid");
    expect(amountOwed(130, 85)).toBe(45);
  });

  it("owes nothing once cancelled", () => {
    expect(effectivePayment({ ...old, status: "cancelled" }).owedEur).toBe(0);
  });
});
