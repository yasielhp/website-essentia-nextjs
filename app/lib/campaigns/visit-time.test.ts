import { describe, expect, it } from "bun:test";
import { canaryWallClockToUtc, visitEndsAtIso } from "./visit-time";

describe("visitEndsAtIso", () => {
  it("reads the wall clock in the Canaries in winter (UTC+0)", () => {
    expect(visitEndsAtIso("2026-12-10", "10:30", "90 min")).toBe(
      "2026-12-10T12:00:00.000Z",
    );
  });

  it("reads the wall clock in the Canaries in summer (UTC+1)", () => {
    expect(visitEndsAtIso("2026-07-10", "10:30", "60 min")).toBe(
      // 10:30 + 60 min = 11:30 local = 10:30Z.
      "2026-07-10T10:30:00.000Z",
    );
  });

  it("accepts HH:MM:SS times and timestamp dates", () => {
    expect(visitEndsAtIso("2026-12-10T00:00:00", "10:30:00", "30 min")).toBe(
      "2026-12-10T11:00:00.000Z",
    );
  });

  it("falls back to 60 minutes without a duration", () => {
    expect(visitEndsAtIso("2026-12-10", "09:00", null)).toBe(
      "2026-12-10T10:00:00.000Z",
    );
  });

  it("is null without date or time", () => {
    expect(visitEndsAtIso(null, "09:00", "60 min")).toBeNull();
    expect(visitEndsAtIso("2026-12-10", null, "60 min")).toBeNull();
  });

  it("handles the day clocks go forward (2026-03-29, 01:00 UTC)", () => {
    expect(canaryWallClockToUtc("2026-03-29", "00:30").toISOString()).toBe(
      "2026-03-29T00:30:00.000Z",
    );
    expect(canaryWallClockToUtc("2026-03-29", "03:00").toISOString()).toBe(
      "2026-03-29T02:00:00.000Z",
    );
  });
});
