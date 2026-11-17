import { describe, expect, test } from "bun:test";
import { reachOutcome } from "./audience-reach";

describe("reachOutcome", () => {
  test("a count is a reach, with its languages", () => {
    expect(
      reachOutcome({ count: 5, byLanguage: { en: 2, es: 3 }, sample: [] }),
    ).toEqual({ ok: true, reach: { count: 5, en: 2, es: 3 } });
  });
  test("a real zero is a zero, not a failure", () => {
    expect(
      reachOutcome({ count: 0, byLanguage: { en: 0, es: 0 }, sample: [] }),
    ).toEqual({ ok: true, reach: { count: 0, en: 0, es: 0 } });
  });
  test("an error answer is a failure and says nothing about the count", () => {
    expect(reachOutcome({ ok: false, error: "invalid" })).toEqual({
      ok: false,
    });
    expect(reachOutcome({ ok: false, error: "generic" })).toEqual({
      ok: false,
    });
  });
  test("a thrown request, or nonsense, is a failure too", () => {
    expect(reachOutcome(null)).toEqual({ ok: false });
    expect(reachOutcome(undefined)).toEqual({ ok: false });
    expect(reachOutcome({ count: "5", byLanguage: { en: 1, es: 4 } })).toEqual({
      ok: false,
    });
    expect(reachOutcome({ count: 5 })).toEqual({ ok: false });
  });
});
