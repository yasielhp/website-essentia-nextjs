import { describe, expect, test } from "bun:test";
import { clashes, fakeBookingsDb, NO_OVERLAP_FROM } from "./fake-bookings-db";

/**
 * The in-memory database the booking tests run against must read a query the
 * way PostgREST does and keep the overlap rule the way the migration does, or
 * the tests prove nothing. These pin the parts that matter.
 */

const STAFF = "33333333-3333-4333-8333-333333333333";
const at = (date: string, time: string, status = "confirmed") => ({
  id: `${date}-${time}-${status}`,
  status,
  staff_id: STAFF,
  date,
  time,
  duration: "50 min",
});

describe("the fake keeps the overlap rule as the migration writes it", () => {
  test("from the day the guard starts, two holding bookings of one professional clash", () => {
    expect(NO_OVERLAP_FROM).toBe("2026-11-24");
    expect(
      clashes(at("2026-12-01", "10:30"), [at("2026-12-01", "10:00")]),
    ).toBe(true);
  });

  test("before it, history is not judged (the pair of 2026-09-23)", () => {
    expect(
      clashes(at("2026-09-23", "17:00"), [at("2026-09-23", "16:30")]),
    ).toBe(false);
  });

  test("drafts and cancelled bookings hold nothing", () => {
    expect(
      clashes(at("2026-12-01", "10:30", "draft"), [at("2026-12-01", "10:00")]),
    ).toBe(false);
    expect(
      clashes(at("2026-12-01", "10:30"), [
        at("2026-12-01", "10:00", "cancelled"),
      ]),
    ).toBe(false);
  });
});

describe("the fake reads filters as PostgREST does", () => {
  const tables = () => ({
    bookings: [
      {
        id: "a",
        status: "pending",
        payment_status: "pending",
        email: "Ana@x.com",
      },
      {
        id: "b",
        status: "pending",
        payment_status: "paid",
        email: "ana@x.com",
      },
      {
        id: "c",
        status: "draft",
        payment_status: "failed",
        email: "ana_b@x.com",
      },
    ],
    service_tiers: [],
    staff_tiers: [],
    contacts: [],
    service_settings: [],
  });

  test(".in() keeps only the listed values", async () => {
    const { db } = fakeBookingsDb(tables());
    const { data } = await db
      .from("bookings")
      .select("id")
      .in("payment_status", ["pending", "failed"]);
    expect((data as { id: string }[]).map((r) => r.id)).toEqual(["a", "c"]);
  });

  test(".ilike() with no wildcard is a case-blind equality, with escapes read", async () => {
    const { db } = fakeBookingsDb(tables());
    const { data } = await db
      .from("bookings")
      .select("id")
      .ilike("email", "ANA@X.COM");
    expect((data as { id: string }[]).map((r) => r.id)).toEqual(["a", "b"]);
    const { data: escaped } = await db
      .from("bookings")
      .select("id")
      .ilike("email", "ana\\_b@x.com");
    expect((escaped as { id: string }[]).map((r) => r.id)).toEqual(["c"]);
  });
});
