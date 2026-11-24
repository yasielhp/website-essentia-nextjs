import { describe, expect, test } from "bun:test";
import {
  mayActOnBooking,
  partnerMayEdit,
  PARTNER_EDIT_MIN_MINUTES,
} from "./booking-access";

/**
 * Who may act on a booking through the service key, and until when a partner
 * may edit one. Pure: the actions apply them in `booking-access.ts`.
 */

const ME = "77777777-7777-4777-8777-777777777777";
const SOMEONE = "44444444-4444-4444-8444-444444444444";

describe("mayActOnBooking", () => {
  test("admin and staff, any booking", () => {
    for (const role of ["admin", "staff"] as const) {
      expect(mayActOnBooking({ userId: ME, role }, SOMEONE)).toBe(true);
      expect(mayActOnBooking({ userId: ME, role }, null)).toBe(true);
    }
  });

  test("a partner, only hers", () => {
    const partner = { userId: ME, role: "partner" as const };
    expect(mayActOnBooking(partner, ME)).toBe(true);
    expect(mayActOnBooking(partner, SOMEONE)).toBe(false);
    // A booking of nobody's is not hers either.
    expect(mayActOnBooking(partner, null)).toBe(false);
    expect(mayActOnBooking(partner, undefined)).toBe(false);
  });

  test("anybody else, none, even a booking that names her", () => {
    for (const role of ["client", "member", "lead"]) {
      expect(mayActOnBooking({ userId: ME, role: role as "admin" }, ME)).toBe(
        false,
      );
    }
  });
});

describe("partnerMayEdit, on the Canary clock", () => {
  // 2026-07-15 09:00 in the Canaries is 08:00 UTC (summer, UTC+1).
  const summer = Date.UTC(2026, 6, 15, 8, 0);
  // 2026-01-15 09:00 in the Canaries is 09:00 UTC (winter, UTC+0).
  const winter = Date.UTC(2026, 0, 15, 9, 0);

  test("the rule her screen applies: more than 23 hours and 59 minutes", () => {
    expect(PARTNER_EDIT_MIN_MINUTES).toBe(23 * 60 + 59);
  });

  test("in summer: 09:01 tomorrow is editable, 09:00 tomorrow is not", () => {
    // 24 h 01 min away, then exactly 24 h away; the limit is > 23 h 59 min.
    expect(partnerMayEdit("2026-07-16", "09:01", summer)).toBe(true);
    expect(partnerMayEdit("2026-07-16", "09:00", summer)).toBe(true);
    expect(partnerMayEdit("2026-07-16", "08:59", summer)).toBe(false);
    expect(partnerMayEdit("2026-07-15", "18:00", summer)).toBe(false);
  });

  test("in winter, the same wall clock", () => {
    expect(partnerMayEdit("2026-01-16", "09:00", winter)).toBe(true);
    expect(partnerMayEdit("2026-01-16", "08:59", winter)).toBe(false);
  });

  test("the hour is the Canaries', not the server's UTC", () => {
    // 08:30 tomorrow in the Canaries is 07:30 UTC: 23 h 30 min away, not
    // editable. Read as UTC it would be 24 h 30 min away, and editable.
    expect(partnerMayEdit("2026-07-16", "08:30", summer)).toBe(false);
  });

  test("a session that has begun or passed is not editable", () => {
    expect(partnerMayEdit("2026-07-14", "10:00", summer)).toBe(false);
  });

  test("a booking with no day or no hour is, as on her screen", () => {
    expect(partnerMayEdit(null, "10:00", summer)).toBe(true);
    expect(partnerMayEdit("2026-07-15", null, summer)).toBe(true);
    expect(partnerMayEdit("", "", summer)).toBe(true);
  });
});
