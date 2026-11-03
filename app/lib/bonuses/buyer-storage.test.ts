import { describe, expect, it } from "bun:test";
import { EMPTY_BUYER, parseBuyer } from "./buyer-storage";

describe("parseBuyer", () => {
  it("reads a stored draft", () => {
    const raw = JSON.stringify({
      firstName: "Fiona",
      lastName: "Smith",
      email: "f@x.es",
      phone: "+34600000000",
    });
    expect(parseBuyer(raw)).toEqual({
      firstName: "Fiona",
      lastName: "Smith",
      email: "f@x.es",
      phone: "+34600000000",
    });
  });

  it("is empty when nothing is stored or it is not JSON", () => {
    expect(parseBuyer(null)).toEqual(EMPTY_BUYER);
    expect(parseBuyer("{nope")).toEqual(EMPTY_BUYER);
  });

  it("drops fields that are not strings", () => {
    expect(parseBuyer(JSON.stringify({ firstName: 3, email: ["a"] }))).toEqual(
      EMPTY_BUYER,
    );
  });

  it("never carries anything beyond the four fields", () => {
    const out = parseBuyer(
      JSON.stringify({ firstName: "A", consent: true, planId: "x" }),
    );
    expect(Object.keys(out).sort()).toEqual([
      "email",
      "firstName",
      "lastName",
      "phone",
    ]);
  });

  it("cuts absurdly long values", () => {
    expect(
      parseBuyer(JSON.stringify({ firstName: "a".repeat(500) })).firstName,
    ).toHaveLength(80);
  });
});
