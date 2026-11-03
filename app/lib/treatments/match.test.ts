import { describe, expect, it } from "bun:test";
import { sameTreatment, treatmentForTier } from "./match";

const treatments = [
  { id: "drenaje-linfatico", title: "Drenaje Linfático Avanzado" },
  { id: "essentia-active", title: "Essentia Active" },
];

describe("sameTreatment", () => {
  it("matches a label to a title ignoring case and spaces", () => {
    expect(
      sameTreatment(
        " drenaje linfático avanzado ",
        "Drenaje Linfático Avanzado",
      ),
    ).toBe(true);
  });

  it("does not match different titles", () => {
    expect(sameTreatment("Essentia Active", "Drenaje Linfático Avanzado")).toBe(
      false,
    );
  });

  it("never matches an empty or missing side", () => {
    expect(sameTreatment(null, "x")).toBe(false);
    expect(sameTreatment("x", undefined)).toBe(false);
    expect(sameTreatment("", "")).toBe(false);
  });
});

describe("treatmentForTier", () => {
  it("finds the treatment a tier label belongs to", () => {
    expect(treatmentForTier(treatments, "Essentia Active")?.id).toBe(
      "essentia-active",
    );
  });

  it("returns null when no treatment carries that label", () => {
    expect(treatmentForTier(treatments, "Algo que no existe")).toBeNull();
    expect(treatmentForTier(treatments, null)).toBeNull();
  });
});
