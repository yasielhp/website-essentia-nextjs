import { describe, expect, it } from "bun:test";
import { bookingMoney, ledgerTotals } from "./ledger";

const base = {
  status: "confirmed",
  payment_status: "pending",
  payment_mode: null as string | null,
  price_eur: 100,
  amount_paid_eur: 0,
};

describe("bookingMoney", () => {
  it("reads an old confirmed booking as completed at its price", () => {
    expect(bookingMoney(base)).toEqual({ amount: 100, status: "completed" });
  });

  it("leaves an old booking that failed or was refunded out of the income", () => {
    expect(bookingMoney({ ...base, payment_status: "failed" }).status).toBe(
      "failed",
    );
    expect(bookingMoney({ ...base, payment_status: "refunded" }).status).toBe(
      "refunded",
    );
  });

  it("counts a deposit as what was paid, with the price beside it and the rest owed", () => {
    expect(
      bookingMoney({
        ...base,
        payment_mode: "deposit",
        payment_status: "deposit_paid",
        amount_paid_eur: 50,
      }),
    ).toEqual({
      amount: 50,
      listAmount: 100,
      owed: 50,
      status: "deposit_paid",
    });
  });

  it("counts a fully paid new booking as completed with nothing owed", () => {
    expect(
      bookingMoney({
        ...base,
        payment_mode: "full",
        payment_status: "paid",
        // The checkout records the discounted price as the booking's own.
        price_eur: 95,
        amount_paid_eur: 95,
      }),
    ).toMatchObject({ amount: 95, owed: 0, status: "completed" });
  });

  it("owes nothing on a booking paid with a bonus or already cancelled", () => {
    expect(
      bookingMoney({ ...base, payment_mode: "bonus", payment_status: "paid" })
        .owed,
    ).toBe(0);
    expect(
      bookingMoney({ ...base, payment_mode: "deposit", status: "cancelled" })
        .owed,
    ).toBe(0);
  });
});

describe("ledgerTotals", () => {
  it("adds up what came in, what is owed and what is complete", () => {
    expect(
      ledgerTotals([
        { status: "completed", amount: 100 },
        { status: "deposit_paid", amount: 50, owed: 50 },
        { status: "pending", amount: 0, owed: 80 },
        { status: "failed", amount: 30 },
        { status: "completed", amount: null },
      ]),
    ).toEqual({ revenue: 150, owed: 130, completed: 2, total: 5 });
  });

  it("is zero for an empty list and avoids float dust", () => {
    expect(ledgerTotals([])).toEqual({
      revenue: 0,
      owed: 0,
      completed: 0,
      total: 0,
    });
    expect(
      ledgerTotals([
        { status: "completed", amount: 0.1 },
        { status: "completed", amount: 0.2 },
      ]).revenue,
    ).toBe(0.3);
  });
});
