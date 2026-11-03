import { describe, expect, it } from "bun:test";
import { canSubmitConsent, signatureSource } from "./signature";

describe("signatureSource", () => {
  it("uses a newly drawn signature in either mode", () => {
    expect(signatureSource("first", true, null)).toEqual({ use: "new" });
    expect(signatureSource("replace", true, "c1/1.png")).toEqual({
      use: "new",
    });
  });

  it("keeps the signature on file when a correction draws none", () => {
    expect(signatureSource("replace", false, "c1/1.png")).toEqual({
      use: "keep",
    });
  });

  it("has nothing to sign with when a correction finds no earlier file", () => {
    expect(signatureSource("replace", false, null)).toEqual({ use: "none" });
  });

  it("never lets a first signing go without a drawn signature", () => {
    expect(signatureSource("first", false, null)).toEqual({ use: "none" });
    expect(signatureSource("first", false, "c1/1.png")).toEqual({
      use: "none",
    });
  });
});

describe("canSubmitConsent", () => {
  const ready = {
    allAnswered: true,
    treatmentAccepted: true,
    healthDataAccepted: true,
    drewSignature: true,
    keepingSignature: false,
  };

  it("needs a drawn signature the first time", () => {
    expect(canSubmitConsent(ready)).toBe(true);
    expect(canSubmitConsent({ ...ready, drewSignature: false })).toBe(false);
  });

  it("does not need a new one while the signature on record is kept", () => {
    expect(
      canSubmitConsent({
        ...ready,
        drewSignature: false,
        keepingSignature: true,
      }),
    ).toBe(true);
  });

  it("asks for a signature again once the kept one is erased", () => {
    expect(
      canSubmitConsent({
        ...ready,
        drewSignature: false,
        keepingSignature: false,
      }),
    ).toBe(false);
  });

  it("accepts a new drawing over a kept signature", () => {
    expect(canSubmitConsent({ ...ready, keepingSignature: true })).toBe(true);
  });

  it("always needs every answer and both switches", () => {
    const edit = { ...ready, drewSignature: false, keepingSignature: true };
    expect(canSubmitConsent({ ...edit, allAnswered: false })).toBe(false);
    expect(canSubmitConsent({ ...edit, treatmentAccepted: false })).toBe(false);
    expect(canSubmitConsent({ ...edit, healthDataAccepted: false })).toBe(
      false,
    );
  });
});
