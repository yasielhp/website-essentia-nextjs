import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";

/**
 * `fetchAvailability`, run for real with the database and Google replaced.
 * What is under test is the one thing the public form adds to it: the
 * visitor's own draft does not take her hour away from her, and that door
 * opens for a draft and for nothing else.
 *
 * Modules are put back afterwards: `mock.module` is process-wide.
 */

const STAFF = "staff-1";
const DAY = "2099-06-01";
const OWN = "3f2b8c1e-5d47-4a9b-8e21-0c9d7a6b5e4f";
const OTHER = "9a1c7e2d-0b34-4f6a-9c85-1e2f3a4b5c6d";

type Booking = {
  id: string;
  staff_id: string;
  date: string;
  time: string;
  duration: string;
  status: string;
  created_at: string;
};

let bookings: Booking[] = [];
let bookingColumns = "";

// Every weekday, 10:00 to 12:00: two one-hour sessions a day.
const schedule = Object.fromEntries(
  [0, 1, 2, 3, 4, 5, 6].map((weekday) => [
    String(weekday),
    { open: true, start: "10:00", end: "12:00" },
  ]),
);

/** Every filter returns the chain; awaiting it gives the table's rows. */
function table(name: string) {
  const rows =
    name === "staff_tiers"
      ? [{ staff_id: STAFF }]
      : name === "profiles"
        ? [{ id: STAFF, schedule, slot_interval_minutes: 60 }]
        : bookings;
  const chain: Record<string, unknown> = {
    select: (columns: string) => {
      if (name === "bookings") bookingColumns = columns;
      return chain;
    },
    then: (resolve: (value: { data: unknown; error: null }) => void) =>
      resolve({ data: rows, error: null }),
  };
  for (const op of ["eq", "in", "gte", "lte", "neq"]) chain[op] = () => chain;
  return chain;
}

const real = {
  admin: { ...(await import("@/lib/insforge-admin")) },
  google: { ...(await import("@/lib/google-calendar")) },
};

let fetchAvailability: typeof import("@/actions/availability").fetchAvailability;

beforeAll(async () => {
  mock.module("@/lib/insforge-admin", () => ({
    ...real.admin,
    getAdminClient: () => ({ database: { from: table } }),
  }));
  mock.module("@/lib/google-calendar", () => ({
    ...real.google,
    getStaffAccessToken: async () => null,
  }));
  ({ fetchAvailability } = await import("@/actions/availability"));
});

afterAll(() => {
  mock.module("@/lib/insforge-admin", () => real.admin);
  mock.module("@/lib/google-calendar", () => real.google);
});

const booking = (over: Partial<Booking>): Booking => ({
  id: OWN,
  staff_id: STAFF,
  date: DAY,
  time: "10:00",
  duration: "60 min",
  status: "draft",
  created_at: new Date().toISOString(),
  ...over,
});

const ask = (excludeDraftId?: unknown) =>
  fetchAvailability({
    tierId: "tier-1",
    staffId: STAFF,
    from: DAY,
    to: DAY,
    durationMinutes: 60,
    excludeDraftId: excludeDraftId as string | null | undefined,
  });

beforeEach(() => {
  bookings = [];
  bookingColumns = "";
});

describe("fetchAvailability and the visitor's own draft", () => {
  test("with nobody booked, the day's hours are all on offer", async () => {
    expect(await ask()).toEqual({ [DAY]: ["10:00", "11:00"] });
  });

  test("a draft holds its hour for everybody else, as it always did", async () => {
    bookings = [booking({})];
    expect(await ask()).toEqual({ [DAY]: ["11:00"] });
    expect(await ask(OTHER)).toEqual({ [DAY]: ["11:00"] });
  });

  test("her own hour is free to her: the draft she is filling in does not take it", async () => {
    bookings = [booking({})];
    expect(await ask(OWN)).toEqual({ [DAY]: ["10:00", "11:00"] });
    expect(await ask(OWN.toUpperCase())).toEqual({
      [DAY]: ["10:00", "11:00"],
    });
    expect(bookingColumns.split(", ")).toContain("id");
  });

  test("somebody else's booking id frees nothing: a real booking keeps its hour whoever names it", async () => {
    for (const status of ["pending", "confirmed", "completed"]) {
      bookings = [booking({ id: OTHER, status })];
      expect(await ask(OTHER)).toEqual({ [DAY]: ["11:00"] });
    }
  });

  test("only her draft is let through, not the rest of the day", async () => {
    bookings = [
      booking({}),
      booking({ id: OTHER, time: "11:00", status: "confirmed" }),
    ];
    expect(await ask(OWN)).toEqual({ [DAY]: ["10:00"] });
  });

  test("what is not a uuid excludes nothing", async () => {
    bookings = [booking({})];
    for (const id of ["", "b-1", "*", 42, {}, null, `${OWN},${OTHER}`]) {
      expect(await ask(id)).toEqual({ [DAY]: ["11:00"] });
    }
  });
});
