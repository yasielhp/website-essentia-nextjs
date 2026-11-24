import { afterEach, describe, expect, it } from "bun:test";
import {
  hoursUntilSession,
  isOutsideCancellationWindow,
  sessionStartsAt,
} from "./cancellation-window";

/**
 * The 24-hour rule read in the Canaries' own time. Winter is UTC+0, summer
 * UTC+1; in 2026 the clocks go forward on 29 March at 01:00 UTC and back on 25
 * October at 01:00 UTC.
 */

const at = (iso: string) => Date.parse(iso);
const ORIGINAL_TZ = process.env.TZ;

afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

describe("sessionStartsAt", () => {
  it("reads a winter hour as UTC+0", () => {
    expect(sessionStartsAt("2026-01-15", "10:00")?.toISOString()).toBe(
      "2026-01-15T10:00:00.000Z",
    );
  });

  it("reads a summer hour as UTC+1", () => {
    expect(sessionStartsAt("2026-07-15", "10:00")?.toISOString()).toBe(
      "2026-07-15T09:00:00.000Z",
    );
  });

  it("reads the date column as the database returns it, a timestamp", () => {
    expect(
      sessionStartsAt("2026-07-15T00:00:00.000Z", "10:00")?.toISOString(),
    ).toBe("2026-07-15T09:00:00.000Z");
  });

  it("starts a booking with no hour at the first moment of its day", () => {
    expect(sessionStartsAt("2026-07-15", null)?.toISOString()).toBe(
      "2026-07-14T23:00:00.000Z",
    );
  });

  it("is null with no day or an unreadable one", () => {
    expect(sessionStartsAt(null, "10:00")).toBeNull();
    expect(sessionStartsAt("mañana", "10:00")).toBeNull();
  });
});

describe("the 24-hour limit in summer (UTC+1)", () => {
  // 10:00 in the Canaries on 15 July is 09:00 UTC.
  const date = "2026-07-15";
  const time = "10:00";

  it("is still open exactly 24 hours before", () => {
    expect(hoursUntilSession(date, time, at("2026-07-14T09:00:00Z"))).toBe(24);
    expect(
      isOutsideCancellationWindow(date, time, at("2026-07-14T09:00:00Z")),
    ).toBe(true);
  });

  it("closes a minute later, 23 h 59 min before", () => {
    expect(
      isOutsideCancellationWindow(date, time, at("2026-07-14T09:01:00Z")),
    ).toBe(false);
  });

  it("is closed 23 hours before, which the server's clock in UTC used to allow", () => {
    // 10:00 UTC on the 14th is 11:00 in the Canaries: 23 hours to go.
    expect(hoursUntilSession(date, time, at("2026-07-14T10:00:00Z"))).toBe(23);
    expect(
      isOutsideCancellationWindow(date, time, at("2026-07-14T10:00:00Z")),
    ).toBe(false);
  });
});

describe("the 24-hour limit in winter (UTC+0)", () => {
  const date = "2026-01-15";
  const time = "10:00";

  it("is open exactly 24 hours before and closed a minute later", () => {
    expect(
      isOutsideCancellationWindow(date, time, at("2026-01-14T10:00:00Z")),
    ).toBe(true);
    expect(
      isOutsideCancellationWindow(date, time, at("2026-01-14T10:01:00Z")),
    ).toBe(false);
  });
});

describe("across a change of the clocks", () => {
  it("counts real hours over the night the clocks go forward", () => {
    // 10:00 on Sunday 29 March is summer time (09:00 UTC); 24 real hours
    // before is 09:00 on Saturday, still winter time (09:00 UTC).
    expect(
      hoursUntilSession("2026-03-29", "10:00", at("2026-03-28T09:00:00Z")),
    ).toBe(24);
    expect(
      isOutsideCancellationWindow(
        "2026-03-29",
        "10:00",
        at("2026-03-28T09:30:00Z"),
      ),
    ).toBe(false);
    // 10:00 on Saturday by the wall clock is already 23 hours before.
    expect(
      isOutsideCancellationWindow(
        "2026-03-29",
        "10:00",
        at("2026-03-28T10:00:00Z"),
      ),
    ).toBe(false);
  });

  it("counts real hours over the night the clocks go back", () => {
    // 10:00 on Sunday 25 October is winter time (10:00 UTC); 24 real hours
    // before is 11:00 on Saturday by the wall clock (10:00 UTC).
    expect(
      hoursUntilSession("2026-10-25", "10:00", at("2026-10-24T10:00:00Z")),
    ).toBe(24);
    expect(
      isOutsideCancellationWindow(
        "2026-10-25",
        "10:00",
        at("2026-10-24T10:00:00Z"),
      ),
    ).toBe(true);
    expect(
      isOutsideCancellationWindow(
        "2026-10-25",
        "10:00",
        at("2026-10-24T10:30:00Z"),
      ),
    ).toBe(false);
  });
});

describe("whatever the server's own time zone", () => {
  for (const zone of [
    "UTC",
    "Europe/Madrid",
    "America/New_York",
    "Asia/Tokyo",
  ]) {
    it(`gives the same answer with TZ=${zone}`, () => {
      process.env.TZ = zone;
      expect(sessionStartsAt("2026-07-15", "10:00")?.toISOString()).toBe(
        "2026-07-15T09:00:00.000Z",
      );
      expect(
        isOutsideCancellationWindow(
          "2026-07-15",
          "10:00",
          at("2026-07-14T09:30:00Z"),
        ),
      ).toBe(false);
    });
  }
});

describe("a session that has begun or has no day", () => {
  it("is never outside the window", () => {
    expect(
      isOutsideCancellationWindow(
        "2026-07-15",
        "10:00",
        at("2026-07-15T12:00:00Z"),
      ),
    ).toBe(false);
    expect(isOutsideCancellationWindow(null, null)).toBe(false);
  });
});
