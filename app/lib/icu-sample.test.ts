import { describe, expect, it } from "bun:test";
import { formatsCleanly, sampleValuesFor } from "./icu-sample";

describe("sampleValuesFor", () => {
  it("gives every argument of the string a value, whatever it is called", () => {
    const values = sampleValuesFor("Hola {anything}, {other}", "es");
    expect(Object.keys(values).sort()).toEqual(["anything", "other"]);
  });

  it("a plural or a number gets a number, a name gets text", () => {
    const values = sampleValuesFor(
      "{count, plural, one {# cosa} other {# cosas}} de {who} ({n, number})",
      "es",
    );
    expect(typeof values.count).toBe("number");
    expect(typeof values.who).toBe("string");
    expect(typeof values.n).toBe("number");
  });

  it("a date gets a date", () => {
    expect(sampleValuesFor("{when, date}", "en").when).toBeInstanceOf(Date);
  });

  it("an argument inside a branch of a plural or a select is found", () => {
    const values = sampleValuesFor(
      "{count, plural, one {{name} tiene uno} other {{name} tiene {extra}}}",
      "en",
    );
    expect(Object.keys(values).sort()).toEqual(["count", "extra", "name"]);
  });

  it("a select gets one of its own options", () => {
    const values = sampleValuesFor(
      "{kind, select, a {A} b {B} other {C}}",
      "en",
    );
    expect(["a", "b", "other"]).toContain(values.kind as string);
  });

  it("a string with no arguments needs none", () => {
    expect(sampleValuesFor("Sin nada", "es")).toEqual({});
  });

  it("a string that is not ICU throws, so a test cannot take it for fine", () => {
    expect(() => sampleValuesFor("{count, plural, one {x}", "es")).toThrow();
  });
});

describe("formatsCleanly", () => {
  it("is true for a string that formats with the values it derives", () => {
    expect(
      formatsCleanly(
        "Hola {name}, tienes {n, plural, one {#} other {#}}",
        "es",
      ),
    ).toBe(true);
  });

  it("is false for an unclosed plural: the mutation the tests must catch", () => {
    expect(formatsCleanly("{count, plural, one {x}", "es")).toBe(false);
  });

  it("is false for a stray brace", () => {
    expect(formatsCleanly("Usa {{1}} aquí", "es")).toBe(false);
  });

  it("is true for the same text with its braces quoted", () => {
    expect(formatsCleanly("Usa '{{'1'}}' aquí", "es")).toBe(true);
  });
});
