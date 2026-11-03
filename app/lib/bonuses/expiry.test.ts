import { describe, expect, it } from "bun:test";
import { bonusExpiry, bonusToday } from "./expiry";

describe("bonusExpiry", () => {
  it("adds the validity to the day of purchase", () => {
    expect(bonusExpiry("2026-12-01", 180)).toBe("2027-05-30");
  });

  it("crosses months and years", () => {
    expect(bonusExpiry("2026-12-20", 15)).toBe("2027-01-04");
  });

  it("does not drift across the spring clock change", () => {
    expect(bonusExpiry("2027-03-20", 30)).toBe("2027-04-19");
  });
});

describe("bonusToday", () => {
  it("reads the day in the Canary Islands, not in UTC", () => {
    // 23:30 UTC in winter is 23:30 in the Canaries; in summer (UTC+1) it is
    // already the next day.
    expect(bonusToday(new Date("2026-07-01T23:30:00Z"))).toBe("2026-07-02");
    expect(bonusToday(new Date("2026-12-01T23:30:00Z"))).toBe("2026-12-01");
  });
});
