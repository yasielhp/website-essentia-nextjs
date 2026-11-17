import { describe, expect, test } from "bun:test";
import {
  isSuppressionTableMissing,
  reachOutcome,
  WHATSAPP_NOT_READY,
} from "./audience-reach";

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

describe("telling a server that is not set up from one that failed for a moment", () => {
  test("Postgres' answer for the missing table is 'not ready'", () => {
    // The real text, read from the live database's answer for this table.
    expect(
      isSuppressionTableMissing(
        new Error(
          'relation "public.whatsapp_suppressed_phones" does not exist',
        ),
      ),
    ).toBe(true);
    expect(
      isSuppressionTableMissing(
        new Error('relation "whatsapp_suppressed_phones" does not exist'),
      ),
    ).toBe(true);
  });
  test("a timeout, a refused connection or another table is not", () => {
    for (const text of [
      "fetch failed",
      "canceling statement due to statement timeout",
      "permission denied for table whatsapp_suppressed_phones",
      'relation "public.contacts" does not exist',
      "",
    ]) {
      expect(isSuppressionTableMissing(new Error(text))).toBe(false);
    }
    expect(isSuppressionTableMissing(null)).toBe(false);
    expect(isSuppressionTableMissing(undefined)).toBe(false);
  });
  test("the preview's answer for it is a failure that says retrying will not help", () => {
    expect(reachOutcome({ ok: false, error: WHATSAPP_NOT_READY })).toEqual({
      ok: false,
      notReady: true,
    });
    expect(reachOutcome({ ok: false, error: "db" })).toEqual({ ok: false });
  });
});
