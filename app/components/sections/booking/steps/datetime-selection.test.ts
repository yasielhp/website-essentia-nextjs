import { describe, expect, test } from "bun:test";
import { selectionGone } from "./datetime-selection";

const AVAILABILITY = {
  "2026-12-03": ["10:00", "10:30", "12:00"],
  "2026-12-04": ["09:00"],
};
const DEC = { year: 2026, month: 11 };
const day = (iso: string) => new Date(`${iso}T00:00:00`);

describe("selectionGone: an hour chosen earlier that is no longer on offer", () => {
  test("an hour still in the list stands", () => {
    expect(
      selectionGone({
        availability: AVAILABILITY,
        loaded: DEC,
        date: day("2026-12-03"),
        time: "10:30",
      }),
    ).toBe(false);
  });

  test("an hour somebody else took meanwhile is gone", () => {
    expect(
      selectionGone({
        availability: AVAILABILITY,
        loaded: DEC,
        date: day("2026-12-03"),
        time: "11:00",
      }),
    ).toBe(true);
  });

  test("a day with nothing left, or one already past, takes its hour with it", () => {
    expect(
      selectionGone({
        availability: AVAILABILITY,
        loaded: DEC,
        date: day("2026-12-01"),
        time: "10:00",
      }),
    ).toBe(true);
  });

  test("nothing chosen is nothing to lose", () => {
    for (const [date, time] of [
      [null, "10:00"],
      [day("2026-12-03"), null],
      [day("2026-12-03"), ""],
    ] as const) {
      expect(
        selectionGone({ availability: AVAILABILITY, loaded: DEC, date, time }),
      ).toBe(false);
    }
  });

  test("the list of ANOTHER month says nothing about her day: it is not judged by it", () => {
    expect(
      selectionGone({
        availability: {},
        loaded: { year: 2026, month: 10 },
        date: day("2026-12-03"),
        time: "10:30",
      }),
    ).toBe(false);
  });
});
