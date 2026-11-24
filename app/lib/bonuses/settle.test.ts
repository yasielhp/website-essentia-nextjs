import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";

/**
 * The real `settleBonusOnCancel` and `readBonusUses`, with the database and
 * the history replaced: what a cancelled bonus session records, and what the
 * bonus then counts.
 */

let bookingRow: Record<string, unknown> | null = null;
let bookings: Record<string, unknown>[] = [];
let entries: Record<string, unknown>[] = [];
let entriesError: unknown = null;
let recorded: {
  event?: string;
  channel?: string;
  summary?: string;
  actorRole?: string | null;
  payload?: Record<string, unknown> | null;
}[] = [];

function chain(table: string): unknown {
  const ops: string[] = [];
  const result = () => {
    if (table === "bookings") {
      return ops.includes("maybeSingle")
        ? { data: bookingRow, error: null }
        : { data: bookings, error: null };
    }
    if (table === "contact_bonuses")
      return { data: contactBonuses, error: null };
    if (table === "booking_events") {
      return entriesError
        ? { data: null, error: entriesError }
        : { data: entries, error: null };
    }
    return { data: null, error: null };
  };
  const proxy: unknown = new Proxy(() => {}, {
    get(_t, prop) {
      if (prop === "then") {
        return (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) =>
          Promise.resolve(result()).then(ok, bad);
      }
      return () => {
        ops.push(String(prop));
        return proxy;
      };
    },
    apply: () => proxy,
  });
  return proxy;
}

let contactBonuses: Record<string, unknown>[] = [];

const real = {
  admin: { ...(await import("@/lib/insforge-admin")) },
  record: { ...(await import("@/lib/booking-events/record")) },
  guard: { ...(await import("@/lib/auth-guard")) },
};
let fetchContactBonuses: typeof import("@/actions/bonuses").fetchContactBonuses;
let settleBonusOnCancel: typeof import("./settle").settleBonusOnCancel;
let readBonusUses: typeof import("./uses").readBonusUses;

beforeAll(async () => {
  mock.module("@/lib/insforge-admin", () => ({
    ...real.admin,
    getAdminClient: () => ({ database: { from: (t: string) => chain(t) } }),
  }));
  mock.module("@/lib/booking-events/record", () => ({
    ...real.record,
    recordBookingEvent: async (e: (typeof recorded)[number]) => {
      recorded.push(e);
    },
  }));
  mock.module("@/lib/auth-guard", () => ({
    ...real.guard,
    requireRole: async () => ({ userId: "u-1", role: "admin" }),
  }));
  ({ settleBonusOnCancel } = await import("./settle"));
  ({ readBonusUses } = await import("./uses"));
  ({ fetchContactBonuses } = await import("@/actions/bonuses"));
});

afterAll(() => {
  mock.module("@/lib/insforge-admin", () => real.admin);
  mock.module("@/lib/booking-events/record", () => real.record);
  mock.module("@/lib/auth-guard", () => real.guard);
});

beforeEach(() => {
  bookingRow = {
    payment_mode: "bonus",
    bonus_id: "bn-1",
    contact_bonuses: { sessions_total: 5 },
  };
  bookings = [];
  entries = [];
  entriesError = null;
  recorded = [];
});

// 10:00 on 15 July in the Canaries (summer) is 09:00 UTC.
const SESSION = { date: "2026-07-15", time: "10:00" };
const cancel = (
  now: string,
  source: "client_link" | "dashboard" | "assistant" = "dashboard",
  teamReturnsLate?: boolean,
) =>
  settleBonusOnCancel({
    bookingId: "b-1",
    source,
    actorId: "u-1",
    actorRole: source === "client_link" ? "client" : "admin",
    ...SESSION,
    teamReturnsLate,
    now: Date.parse(now),
  });

describe("settleBonusOnCancel", () => {
  test("two days before: the session goes back to the bonus, and the history says so", async () => {
    const res = await cancel("2026-07-13T09:00:00Z", "client_link");
    expect(res).toEqual({ bonus: true, returned: true, reason: "in_advance" });
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      channel: "system",
      event: "bonus_returned",
      actorRole: "client",
      summary:
        "Sesión devuelta al bono de 5 sesiones · cancelada con 48 h de antelación",
      payload: { bonusId: "bn-1", reason: "in_advance" },
    });
  });

  test("23 hours before in summer (which the UTC clock read as 24): lost, by the team's default", async () => {
    const res = await cancel("2026-07-14T10:00:00Z");
    expect(res).toEqual({ bonus: true, returned: false, reason: "late" });
    expect(recorded[0]).toMatchObject({ event: "bonus_lost" });
    expect(recorded[0]!.summary).toBe(
      "Sesión perdida del bono de 5 sesiones · cancelada con 23 h de antelación (menos de 24 h) · decisión del equipo",
    );
  });

  test("inside the 24 hours, ticked by the team: given back, said as their decision", async () => {
    const res = await cancel("2026-07-15T04:00:00Z", "assistant", true);
    expect(res).toEqual({
      bonus: true,
      returned: true,
      reason: "late_team_returns",
    });
    expect(recorded[0]!.summary).toBe(
      "Sesión devuelta al bono de 5 sesiones · cancelada con 5 h de antelación · decisión del equipo",
    );
  });

  test("winter: a minute past the 24 hours is lost", async () => {
    const res = await settleBonusOnCancel({
      bookingId: "b-1",
      source: "dashboard",
      actorRole: "staff",
      date: "2026-01-15",
      time: "10:00",
      now: Date.parse("2026-01-14T10:01:00Z"),
    });
    expect(res).toMatchObject({ returned: false });
  });

  test("a booking not drawn from a bonus writes nothing", async () => {
    bookingRow = {
      payment_mode: "full",
      bonus_id: null,
      contact_bonuses: null,
    };
    expect(await cancel("2026-07-14T10:00:00Z")).toEqual({ bonus: false });
    expect(recorded).toEqual([]);
  });
});

describe("readBonusUses: what the bonus counts", () => {
  const minute = (m: number) =>
    new Date(Date.UTC(2026, 10, 24, 0, m)).toISOString();

  test("a lost cancellation is reported as lost; a returned one or an old one stays cancelled", async () => {
    bookings = [
      {
        id: "b1",
        bonus_id: "bn-1",
        date: "2026-07-01",
        time: "10:00",
        status: "completed",
      },
      {
        id: "b2",
        bonus_id: "bn-1",
        date: "2026-07-08",
        time: "10:00",
        status: "cancelled",
      },
      {
        id: "b3",
        bonus_id: "bn-1",
        date: "2026-07-15",
        time: "10:00",
        status: "cancelled",
      },
      {
        id: "b4",
        bonus_id: "bn-1",
        date: "2026-07-22",
        time: "10:00",
        status: "cancelled",
      },
    ];
    entries = [
      { booking_id: "b2", event: "bonus_lost", created_at: minute(1) },
      { booking_id: "b3", event: "bonus_lost", created_at: minute(1) },
      { booking_id: "b3", event: "bonus_returned", created_at: minute(2) },
    ];
    const uses = await readBonusUses(["bn-1"]);
    expect(uses.map((u) => [u.id, u.status])).toEqual([
      ["b1", "completed"],
      ["b2", "lost"],
      ["b3", "cancelled"],
      ["b4", "cancelled"],
    ]);
  });

  test("a history that cannot be read loses nobody's session", async () => {
    bookings = [
      {
        id: "b2",
        bonus_id: "bn-1",
        date: "2026-07-08",
        time: "10:00",
        status: "cancelled",
      },
    ];
    entriesError = { message: "down" };
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    const uses = await readBonusUses(["bn-1"]);
    quiet.mockRestore();
    expect(uses[0]!.status).toBe("cancelled");
  });
});

describe("the contact's bonus card", () => {
  test("counts the lost session as used and says how many were lost", async () => {
    contactBonuses = [
      {
        id: "bn-1",
        plan_id: null,
        tier_id: "t-1",
        sessions_total: 5,
        price_eur: "300.00",
        paid_method: "card",
        purchased_at: "2026-06-01",
        expires_at: "2027-06-01",
        notes: null,
        service_tiers: { label: "Drenaje" },
      },
    ];
    bookings = [
      {
        id: "b1",
        bonus_id: "bn-1",
        date: "2026-07-01",
        time: "10:00",
        status: "completed",
      },
      {
        id: "b2",
        bonus_id: "bn-1",
        date: "2026-07-08",
        time: "10:00",
        status: "cancelled",
      },
      {
        id: "b3",
        bonus_id: "bn-1",
        date: "2026-07-15",
        time: "10:00",
        status: "cancelled",
      },
    ];
    entries = [
      {
        booking_id: "b2",
        event: "bonus_lost",
        created_at: "2026-07-08T05:00:00Z",
      },
      {
        booking_id: "b3",
        event: "bonus_returned",
        created_at: "2026-07-12T05:00:00Z",
      },
    ];
    const [bonus] = await fetchContactBonuses("token", "c-1");
    expect(bonus).toMatchObject({ used: 2, remaining: 3, lost: 1 });
  });
});
