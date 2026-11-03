import { describe, expect, it } from "bun:test";
import {
  UNPAID_EXPIRY_MS,
  isExpiredUnpaid,
  type ExpirableBooking,
} from "./expire-unpaid";

const now = new Date("2026-12-01T12:00:00Z");
const minutesAgo = (m: number) =>
  new Date(now.getTime() - m * 60 * 1000).toISOString();

const base: ExpirableBooking = {
  status: "pending",
  payment_status: "pending",
  payment_mode: "deposit",
  created_by_role: "anonymous",
  created_at: minutesAgo(31),
};

describe("isExpiredUnpaid", () => {
  it("expires an unpaid web booking older than the window", () => {
    expect(isExpiredUnpaid(base, now)).toBe(true);
    expect(isExpiredUnpaid({ ...base, created_by_role: "client" }, now)).toBe(
      true,
    );
  });

  it("keeps a booking still inside the window", () => {
    expect(isExpiredUnpaid({ ...base, created_at: minutesAgo(10) }, now)).toBe(
      false,
    );
    expect(UNPAID_EXPIRY_MS).toBe(30 * 60 * 1000);
  });

  it("never expires one that took money, or one already settled", () => {
    expect(
      isExpiredUnpaid({ ...base, payment_status: "deposit_paid" }, now),
    ).toBe(false);
    expect(isExpiredUnpaid({ ...base, payment_status: "paid" }, now)).toBe(
      false,
    );
    expect(isExpiredUnpaid({ ...base, status: "confirmed" }, now)).toBe(false);
    expect(isExpiredUnpaid({ ...base, status: "draft" }, now)).toBe(false);
  });

  it("never touches bookings made from the dashboard", () => {
    for (const role of ["admin", "staff", "partner", null]) {
      expect(isExpiredUnpaid({ ...base, created_by_role: role }, now)).toBe(
        false,
      );
    }
  });

  it("leaves bookings from before deposits alone", () => {
    expect(isExpiredUnpaid({ ...base, payment_mode: null }, now)).toBe(false);
    expect(isExpiredUnpaid({ ...base, payment_mode: "none" }, now)).toBe(false);
  });

  it("ignores a missing or unreadable creation time", () => {
    expect(isExpiredUnpaid({ ...base, created_at: null }, now)).toBe(false);
    expect(isExpiredUnpaid({ ...base, created_at: "nope" }, now)).toBe(false);
  });

  it("a declined card leaves the booking unpaid, so it expires like one never paid", () => {
    expect(isExpiredUnpaid({ ...base, payment_status: "failed" }, now)).toBe(
      true,
    );
  });

  it("money in, even a deposit, keeps the slot", () => {
    expect(
      isExpiredUnpaid({ ...base, payment_status: "deposit_paid" }, now),
    ).toBe(false);
  });
});
