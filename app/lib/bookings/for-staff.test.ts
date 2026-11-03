import { describe, expect, it } from "bun:test";
import { priceFor } from "./for-staff";

const tier = {
  price_eur: 90,
  price_center_eur: 100,
  price_suite_eur: 130,
};

describe("priceFor", () => {
  it("charges the suite price at a hotel room and the centre price elsewhere", () => {
    expect(priceFor(tier, "habitacion")).toBe(130);
    expect(priceFor(tier, "centro")).toBe(100);
    expect(priceFor(tier, "domicilio")).toBe(100);
  });

  it("falls back along the chain when a price is missing", () => {
    expect(priceFor({ ...tier, price_suite_eur: null }, "habitacion")).toBe(
      100,
    );
    expect(
      priceFor(
        { price_eur: 90, price_center_eur: null, price_suite_eur: null },
        "centro",
      ),
    ).toBe(90);
  });

  it("reads numeric strings and reports no price as null", () => {
    expect(
      priceFor(
        { price_eur: "90.50", price_center_eur: null, price_suite_eur: null },
        "centro",
      ),
    ).toBe(90.5);
    expect(
      priceFor(
        { price_eur: null, price_center_eur: null, price_suite_eur: null },
        "centro",
      ),
    ).toBeNull();
  });
});
