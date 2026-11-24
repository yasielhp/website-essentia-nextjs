import { describe, expect, it } from "bun:test";
import { hoursUntilSession } from "@/lib/bookings/cancellation-window";
import { bonusBalance } from "./balance";
import {
  bonusChoiceOnSave,
  bonusOnCancel,
  lostBookingIds,
  useStatus,
} from "./cancellation";

const at = (iso: string) => Date.parse(iso);
/** The decision for a session at `date time` (Canary time) cancelled at `now`. */
const decide = (
  date: string,
  time: string,
  now: string,
  by: "client" | "team" = "team",
  teamReturnsLate?: boolean,
) =>
  bonusOnCancel({
    hoursBefore: hoursUntilSession(date, time, at(now)),
    by,
    teamReturnsLate,
  });

describe("bonusOnCancel, the 24 hours in the Canaries' own time", () => {
  it("summer (UTC+1): exactly 24 hours before goes back to the bonus", () => {
    // 10:00 on 15 July in the Canaries is 09:00 UTC.
    expect(decide("2026-07-15", "10:00", "2026-07-14T09:00:00Z")).toEqual({
      returned: true,
      reason: "in_advance",
    });
  });

  it("summer: 23 hours before (10:00 UTC the day before) the session is lost", () => {
    expect(decide("2026-07-15", "10:00", "2026-07-14T10:00:00Z")).toEqual({
      returned: false,
      reason: "late",
    });
  });

  it("winter (UTC+0): the same hour by the wall clock, a minute either side", () => {
    expect(decide("2026-01-15", "10:00", "2026-01-14T10:00:00Z").returned).toBe(
      true,
    );
    expect(decide("2026-01-15", "10:00", "2026-01-14T10:01:00Z").returned).toBe(
      false,
    );
  });

  it("over the night the clocks go forward and back, real hours count", () => {
    expect(decide("2026-03-29", "10:00", "2026-03-28T09:00:00Z").returned).toBe(
      true,
    );
    expect(decide("2026-03-29", "10:00", "2026-03-28T10:00:00Z").returned).toBe(
      false,
    );
    expect(decide("2026-10-25", "10:00", "2026-10-24T10:00:00Z").returned).toBe(
      true,
    );
    expect(decide("2026-10-25", "10:00", "2026-10-24T10:30:00Z").returned).toBe(
      false,
    );
  });

  it("inside the 24 hours the team may give it back; a client never", () => {
    expect(
      decide("2026-07-15", "10:00", "2026-07-15T04:00:00Z", "team", true),
    ).toEqual({ returned: true, reason: "late_team_returns" });
    expect(
      decide("2026-07-15", "10:00", "2026-07-15T04:00:00Z", "client", true),
    ).toEqual({ returned: false, reason: "late" });
  });

  it("after the session has begun, and a booking with no day, count as late", () => {
    expect(decide("2026-07-15", "10:00", "2026-07-15T12:00:00Z").returned).toBe(
      false,
    );
    expect(bonusOnCancel({ hoursBefore: -1, by: "team" }).returned).toBe(false);
  });
});

describe("lostBookingIds: the latest word decides", () => {
  const e = (booking_id: string, event: string, minute: number) => ({
    booking_id,
    event,
    created_at: new Date(Date.UTC(2026, 10, 24, 0, minute)).toISOString(),
  });

  it("lost, or lost and then given back", () => {
    const lost = lostBookingIds([
      e("a", "bonus_lost", 1),
      e("b", "bonus_lost", 1),
      e("b", "bonus_returned", 2),
      e("c", "bonus_returned", 1),
      e("d", "edited", 3),
    ]);
    expect([...lost]).toEqual(["a"]);
  });

  it("returned, reactivated and cancelled late again: lost", () => {
    expect([
      ...lostBookingIds([e("a", "bonus_returned", 1), e("a", "bonus_lost", 5)]),
    ]).toEqual(["a"]);
  });
});

describe("the bonus balance counts a lost session as used", () => {
  const bonus = {
    id: "bn-1",
    tierId: "t",
    sessionsTotal: 5,
    expiresAt: "2027-01-01",
  };

  it("a lost cancellation is used; a returned one is not", () => {
    const lost = new Set(["b2"]);
    const uses = [
      { id: "b1", status: "confirmed" },
      { id: "b2", status: "cancelled" },
      { id: "b3", status: "cancelled" },
    ].map((b) => ({ bonusId: "bn-1", status: useStatus(b, lost) }));
    expect(uses.map((u) => u.status)).toEqual([
      "confirmed",
      "lost",
      "cancelled",
    ]);
    expect(bonusBalance(bonus, uses)).toEqual({ used: 2, remaining: 3 });
  });

  it("a session lost and then reactivated counts once, as booked", () => {
    expect(useStatus({ id: "b2", status: "confirmed" }, new Set(["b2"]))).toBe(
      "confirmed",
    );
  });
});

describe("bonusChoiceOnSave: what the edit screen showed is what is recorded", () => {
  it("shown as going back (24 hours or more when chosen): sent as given back", () => {
    expect(bonusChoiceOnSave({ shownInAdvance: true, ticked: false })).toBe(
      true,
    );
  });

  it("inside the 24 hours the box decides, unticked by default", () => {
    expect(bonusChoiceOnSave({ shownInAdvance: false, ticked: false })).toBe(
      false,
    );
    expect(bonusChoiceOnSave({ shownInAdvance: false, ticked: true })).toBe(
      true,
    );
  });
});
