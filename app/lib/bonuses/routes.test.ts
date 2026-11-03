import { describe, expect, it } from "bun:test";
import { bonusCheckoutHref, bonusRouteForTier } from "./routes";

describe("bonusRouteForTier", () => {
  it("finds the manual therapy a session type belongs to, by its label", () => {
    expect(bonusRouteForTier("Drenaje Linfático Avanzado")).toEqual({
      family: "manual-therapies",
      slug: "drenaje-linfatico",
    });
  });

  it("ignores case and surrounding spaces, as the dashboard may type them", () => {
    expect(bonusRouteForTier("  drenaje linfático avanzado ")?.slug).toBe(
      "drenaje-linfatico",
    );
  });

  it("has no route for a session type without a payment page", () => {
    expect(bonusRouteForTier("Aurum")).toBeNull();
    expect(bonusRouteForTier("Calm Drip")).toBeNull();
    expect(bonusRouteForTier(null)).toBeNull();
    expect(bonusRouteForTier("")).toBeNull();
  });
});

describe("bonusCheckoutHref", () => {
  it("builds the localized payment page of a plan under its treatment", () => {
    expect(
      bonusCheckoutHref("en", "manual-therapies", "drenaje-linfatico", "p1"),
    ).toBe("/wellness/manual-therapies/drenaje-linfatico/bonus/checkout/p1");
    expect(
      bonusCheckoutHref("es", "manual-therapies", "drenaje-linfatico", "p1"),
    ).toBe(
      "/es/bienestar/terapias-manuales/drenaje-linfatico/bonus/checkout/p1",
    );
  });
});
