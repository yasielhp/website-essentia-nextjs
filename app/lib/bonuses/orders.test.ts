import { describe, expect, it } from "bun:test";
import { bonusOrderId, shouldGrantBonus, toCents } from "./orders";

describe("bonusOrderId", () => {
  it("is twelve characters, starting with four digits, and has a B", () => {
    const id = bonusOrderId(new Date("2026-12-01T10:00:00Z"), () => 0.5);
    expect(id).toHaveLength(12);
    expect(/^\d{4}/.test(id)).toBe(true);
    expect(id).toContain("B");
    expect(/^[0-9A-Za-z]+$/.test(id)).toBe(true);
  });

  it("can never equal a booking order, which is all digits", () => {
    expect(/^\d+$/.test(bonusOrderId())).toBe(false);
  });

  it("pads the salt", () => {
    expect(bonusOrderId(new Date(12345678), () => 0)).toBe("12345678B000");
  });
});

describe("toCents", () => {
  it("rounds euros to the cent", () => {
    expect(toCents(450)).toBe(45000);
    expect(toCents(79.99)).toBe(7999);
  });
});

describe("shouldGrantBonus", () => {
  const order = { status: "pending", priceEur: 450 };

  it("grants a pending order paid in full", () => {
    expect(shouldGrantBonus(order, 45000)).toEqual({ grant: true });
  });

  it("refuses an order that is not pending, so a retry makes no second bonus", () => {
    expect(shouldGrantBonus({ ...order, status: "paid" }, 45000)).toEqual({
      grant: false,
      reason: "not_pending",
    });
    expect(shouldGrantBonus({ ...order, status: "failed" }, 45000)).toEqual({
      grant: false,
      reason: "not_pending",
    });
  });

  it("refuses less than the price, and more", () => {
    expect(shouldGrantBonus(order, 22500)).toEqual({
      grant: false,
      reason: "amount_mismatch",
    });
    expect(shouldGrantBonus(order, 45001)).toEqual({
      grant: false,
      reason: "amount_mismatch",
    });
  });

  it("refuses an amount that is not a number", () => {
    expect(shouldGrantBonus(order, Number.NaN)).toEqual({
      grant: false,
      reason: "amount_mismatch",
    });
  });
});
