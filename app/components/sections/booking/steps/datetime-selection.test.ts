import { describe, expect, test } from "bun:test";
import { selectionGone, selectionVerified } from "./datetime-selection";

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

describe("selectionVerified: 'next' opens only on an hour the list has confirmed", () => {
  const chosen = { date: day("2026-12-03"), time: "10:30" };

  test("while no list has arrived, nothing is verified, however complete the choice", () => {
    expect(
      selectionVerified({ availability: {}, loaded: null, ...chosen }),
    ).toBe(false);
  });

  test("once her day's list is here and has her hour, it is", () => {
    expect(
      selectionVerified({ availability: AVAILABILITY, loaded: DEC, ...chosen }),
    ).toBe(true);
  });

  test("the list of another month verifies nothing about her day", () => {
    expect(
      selectionVerified({
        availability: AVAILABILITY,
        loaded: { year: 2026, month: 10 },
        ...chosen,
      }),
    ).toBe(false);
  });

  test("an hour the list does not have is not verified", () => {
    expect(
      selectionVerified({
        availability: AVAILABILITY,
        loaded: DEC,
        date: chosen.date,
        time: "11:00",
      }),
    ).toBe(false);
  });

  test("with no day or no hour there is nothing to verify", () => {
    for (const [date, time] of [
      [null, "10:30"],
      [chosen.date, null],
      [chosen.date, ""],
    ] as const) {
      expect(
        selectionVerified({
          availability: AVAILABILITY,
          loaded: DEC,
          date,
          time,
        }),
      ).toBe(false);
    }
  });
});
