import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import {
  fakeBookingsDb,
  type FakeTables,
  type Row,
} from "@/lib/bookings/fake-bookings-db";

/**
 * The dashboard actions that act on ONE booking, run for real with the session
 * check, the database, the history, the notices and the calendars replaced:
 * the bonus of a booking, the client's email, the professional's WhatsApp, the
 * calendars, the history lines of a desk booking, and the edit.
 *
 * Each runs with the service key, so each keeps the rule the browser's key
 * had: admin and staff any booking, a partner only her own (`partner_id`),
 * anybody else none. Their input is checked before anything is read. And a
 * partner edits only while the session is more than 23 h 59 min away, on the
 * Canary clock, as her screen has always said.
 *
 * Modules are put back afterwards: `mock.module` is process-wide.
 */

const STAFF = "33333333-3333-4333-8333-333333333333";
const ME = "77777777-7777-4777-8777-777777777777";
const SOMEONE = "44444444-4444-4444-8444-444444444444";
const CLIENT_PROFILE = "55555555-5555-4555-8555-555555555555";
const OLD_STAFF = "66666666-6666-4666-8666-666666666666";
const MINE = "aaaaaaaa-0000-4000-8000-000000000001";
const THEIRS = "aaaaaaaa-0000-4000-8000-000000000002";
const BONUS = "bbbbbbbb-0000-4000-8000-000000000001";

let role = "partner";
let tables: FakeTables;
let sent: string[] = [];

const real = {
  admin: { ...(await import("@/lib/insforge-admin")) },
  guard: { ...(await import("@/lib/auth-guard")) },
  record: { ...(await import("@/lib/booking-events/record")) },
  notify: { ...(await import("@/lib/bookings/notify")) },
  wa: { ...(await import("@/lib/whatsapp/notify")) },
  propagate: { ...(await import("@/lib/calendar-propagate")) },
  sync: { ...(await import("@/lib/calendar-sync")) },
};

let bonuses: typeof import("@/actions/bonuses");
let notifications: typeof import("@/actions/booking-notifications");
let staffWhatsApp: typeof import("@/actions/staff-whatsapp");
let calendars: typeof import("@/actions/calendar-propagate");
let draft: typeof import("@/actions/booking-draft");
let events: typeof import("@/actions/booking-events");
let contacts: typeof import("@/actions/contacts");

beforeAll(async () => {
  mock.module("@/lib/insforge-admin", () => ({
    ...real.admin,
    getAdminClient: () => ({
      database: {
        from: fakeBookingsDb(tables).db.from,
        rpc: (_name: string, args: { p_id: string; p_payload: Row }) => {
          const row = tables.bookings.find((r) => r.id === args.p_id);
          if (!row) return Promise.resolve({ data: null, error: null });
          const before = { ...row };
          Object.assign(row, args.p_payload);
          return Promise.resolve({ data: before, error: null });
        },
      },
    }),
  }));
  mock.module("@/lib/auth-guard", () => ({
    ...real.guard,
    requireRole: async (
      token: unknown,
      allowed: string[] = ["admin", "staff", "partner"],
    ) => {
      if (!token)
        throw new real.guard.AuthError("Authentication required", 401);
      if (!allowed.includes(role)) {
        throw new real.guard.AuthError(
          "Insufficient permissions for this operation",
          403,
        );
      }
      return { userId: ME, email: null, verifiedEmail: null, role };
    },
  }));
  mock.module("@/lib/booking-events/record", () => ({
    ...real.record,
    actorFromToken: async () => ({ actorId: ME, actorRole: role }),
    recordBookingEvent: async (e: { bookingId: string; event: string }) => {
      sent.push(`history:${e.event}:${e.bookingId}`);
    },
    recordBookingEvents: async () => {},
  }));
  mock.module("@/lib/bookings/notify", () => ({
    ...real.notify,
    notifyBookingCore: async (p: { bookingId: string; event: string }) => {
      sent.push(`email:${p.event}:${p.bookingId}`);
      return { email: "sent" };
    },
  }));
  mock.module("@/lib/whatsapp/notify", () => ({
    ...real.wa,
    notifyStaffOnWhatsApp: async (p: { staffId: string; event: string }) => {
      sent.push(`whatsapp:${p.event}:${p.staffId}`);
    },
  }));
  mock.module("@/lib/calendar-propagate", () => ({
    ...real.propagate,
    updateBookingOnCalendars: async (id: string) => {
      sent.push(`calendar:update:${id}`);
    },
    removeBookingFromCalendars: async (id: string) => {
      sent.push(`calendar:remove:${id}`);
    },
  }));
  mock.module("@/lib/calendar-sync", () => ({
    ...real.sync,
    pushBookingToCalendars: async (id: string) => {
      sent.push(`calendar:push:${id}`);
    },
  }));
  bonuses = await import("@/actions/bonuses");
  notifications = await import("@/actions/booking-notifications");
  staffWhatsApp = await import("@/actions/staff-whatsapp");
  calendars = await import("@/actions/calendar-propagate");
  draft = await import("@/actions/booking-draft");
  events = await import("@/actions/booking-events");
  contacts = await import("@/actions/contacts");
});

afterAll(() => {
  mock.module("@/lib/insforge-admin", () => real.admin);
  mock.module("@/lib/auth-guard", () => real.guard);
  mock.module("@/lib/booking-events/record", () => real.record);
  mock.module("@/lib/bookings/notify", () => real.notify);
  mock.module("@/lib/whatsapp/notify", () => real.wa);
  mock.module("@/lib/calendar-propagate", () => real.propagate);
  mock.module("@/lib/calendar-sync", () => real.sync);
});

/** `YYYY-MM-DD` and `HH:MM` on the Canary wall clock, `ms` from now. */
function canaryIn(ms: number): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Atlantic/Canary",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(Date.now() + ms))
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}
const HOUR = 3_600_000;

const booking = (over: Row = {}): Row => ({
  id: MINE,
  status: "confirmed",
  partner_id: ME,
  staff_id: STAFF,
  contact_id: null,
  tier_id: null,
  bonus_id: null,
  service_title: "Manual Therapies",
  ...canaryIn(72 * HOUR),
  duration: "50 min",
  price_eur: 90,
  amount_paid_eur: 0,
  payment_status: "pending",
  payment_mode: "none",
  ...over,
});

beforeEach(() => {
  role = "partner";
  sent = [];
  tables = {
    bookings: [booking(), booking({ id: THEIRS, partner_id: SOMEONE })],
    service_tiers: [],
    staff_tiers: [],
    contacts: [],
    service_settings: [],
    profiles: [
      { id: STAFF, role: "staff" },
      { id: OLD_STAFF, role: "staff" },
      { id: CLIENT_PROFILE, role: "client" },
    ],
  };
});

describe("the bonus of a booking", () => {
  test("a partner on somebody else's booking is refused, and nothing changes", async () => {
    expect(
      await bonuses.assignBookingBonus("token", {
        bookingId: THEIRS,
        bonusId: BONUS,
      }),
    ).toEqual({ error: "forbidden" });
    tables.bookings[1]!.bonus_id = BONUS;
    expect(await bonuses.clearBookingBonus("token", THEIRS)).toEqual({
      error: "forbidden",
    });
    expect(tables.bookings[1]!.bonus_id).toBe(BONUS);
  });

  test("on her own she gets past the check (this one stops later: it has no contact)", async () => {
    expect(
      await bonuses.assignBookingBonus("token", {
        bookingId: MINE,
        bonusId: BONUS,
      }),
    ).toEqual({ error: "no_contact" });
  });

  test("staff and admin reach any booking", async () => {
    for (const r of ["staff", "admin"]) {
      role = r;
      expect(
        await bonuses.assignBookingBonus("token", {
          bookingId: THEIRS,
          bonusId: BONUS,
        }),
      ).toEqual({ error: "no_contact" });
    }
  });

  test("anybody else, or nobody, is refused", async () => {
    role = "client";
    expect(
      await bonuses.assignBookingBonus("token", {
        bookingId: MINE,
        bonusId: BONUS,
      }),
    ).toEqual({ error: "forbidden" });
    expect(await bonuses.clearBookingBonus(null, MINE)).toEqual({
      error: "forbidden",
    });
  });

  test("what is not two ids is refused before anything is read", async () => {
    for (const input of [
      { bookingId: "1", bonusId: BONUS },
      { bookingId: MINE, bonusId: "x" },
      { bookingId: MINE, bonusId: BONUS, payment_status: "paid" },
      null,
    ]) {
      expect(await bonuses.assignBookingBonus("token", input as never)).toEqual(
        { error: "invalid" },
      );
    }
    expect(await bonuses.clearBookingBonus("token", "' or 1=1")).toEqual({
      error: "invalid",
    });
  });
});

const confirmation = (bookingId: string) => ({
  bookingId,
  event: "confirmed" as const,
  clientName: "Ana García",
  clientEmail: "ana@example.com",
  service: "Manual Therapies",
  date: "2099-08-20",
  time: "10:00",
});

describe("the client's email", () => {
  test("a partner sends it for her own booking, not for somebody else's", async () => {
    expect(
      await notifications.notifyBooking("token", confirmation(MINE)),
    ).toEqual({ ok: true });
    expect(
      await notifications.notifyBooking("token", confirmation(THEIRS)),
    ).toEqual({ ok: false, error: "unauthorized" });
    expect(sent).toEqual([`email:confirmed:${MINE}`]);
  });

  test("a booking that is not there is refused too, and a payload that is not one before anything", async () => {
    role = "staff";
    expect(
      await notifications.notifyBooking(
        "token",
        confirmation("aaaaaaaa-0000-4000-8000-00000000000f"),
      ),
    ).toEqual({ ok: false, error: "unauthorized" });
    expect(
      await notifications.notifyBooking("token", {
        ...confirmation(MINE),
        bookingId: "1",
      }),
    ).toEqual({ ok: false, error: "invalidInput" });
    expect(sent).toEqual([]);
  });
});

describe("the professional's WhatsApp", () => {
  const notice = (over: Record<string, unknown> = {}) => ({
    bookingId: MINE,
    staffId: STAFF,
    event: "assigned",
    ...over,
  });

  test("a partner, for her own booking and to its professional", async () => {
    await staffWhatsApp.notifyStaffWhatsApp("token", notice() as never);
    expect(sent).toEqual([`whatsapp:assigned:${STAFF}`]);
  });

  test("never for somebody else's booking", async () => {
    await staffWhatsApp.notifyStaffWhatsApp(
      "token",
      notice({ bookingId: THEIRS }) as never,
    );
    expect(sent).toEqual([]);
  });

  test("'assigned' and 'rescheduled' go to the booking's professional and nobody else", async () => {
    role = "admin";
    for (const event of ["assigned", "rescheduled"]) {
      await staffWhatsApp.notifyStaffWhatsApp(
        "token",
        notice({ event, staffId: OLD_STAFF }) as never,
      );
    }
    expect(sent).toEqual([]);
  });

  test("'unassigned' and 'cancelled' reach the one taken off, who must be of the team", async () => {
    role = "admin";
    await staffWhatsApp.notifyStaffWhatsApp(
      "token",
      notice({ event: "unassigned", staffId: OLD_STAFF }) as never,
    );
    await staffWhatsApp.notifyStaffWhatsApp(
      "token",
      notice({ event: "cancelled", staffId: OLD_STAFF }) as never,
    );
    await staffWhatsApp.notifyStaffWhatsApp(
      "token",
      notice({ event: "unassigned", staffId: CLIENT_PROFILE }) as never,
    );
    expect(sent).toEqual([
      `whatsapp:unassigned:${OLD_STAFF}`,
      `whatsapp:cancelled:${OLD_STAFF}`,
    ]);
  });

  test("what is not the screen's input is dropped, and so is nobody's session", async () => {
    role = "admin";
    for (const input of [
      notice({ bookingId: "1" }),
      notice({ staffId: "x" }),
      notice({ event: "hello" }),
      notice({ phone: "+34600000000" }),
    ]) {
      await staffWhatsApp.notifyStaffWhatsApp("token", input as never);
    }
    await staffWhatsApp.notifyStaffWhatsApp(null, notice() as never);
    expect(sent).toEqual([]);
  });
});

describe("the calendars", () => {
  test("a partner syncs and pushes her own booking only", async () => {
    await calendars.syncBookingToCalendars("token", MINE, "updated");
    await calendars.syncBookingToCalendars("token", THEIRS, "removed");
    await calendars.pushBookingToCalendarsAction("token", MINE);
    await calendars.pushBookingToCalendarsAction("token", THEIRS);
    expect(sent.filter((s) => s.startsWith("calendar"))).toEqual([
      `calendar:update:${MINE}`,
      `calendar:push:${MINE}`,
    ]);
  });

  test("not an id, not an action, or no session: nothing moves", async () => {
    role = "admin";
    await calendars.syncBookingToCalendars("token", "1", "updated");
    await calendars.syncBookingToCalendars(
      "token",
      MINE,
      "deleted" as "updated",
    );
    await calendars.pushBookingToCalendarsAction("token", "x");
    await calendars.pushBookingToCalendarsAction(null, MINE);
    expect(sent).toEqual([]);
  });
});

describe("the history lines of a desk booking", () => {
  test("written on her own booking, never on somebody else's", async () => {
    await draft.recordBookingCreated("token", MINE);
    await draft.recordBookingCreated("token", THEIRS);
    await draft.recordBookingCreated("token", "1");
    tables.bookings[1]!.amount_paid_eur = 90;
    await draft.recordBookingPaymentNote("token", THEIRS, "cash");
    expect(sent).toEqual([`history:created:${MINE}`]);
  });
});

describe("a partner edits only while the session is more than 23 h 59 min away (Canary time)", () => {
  const edit = (id: string) =>
    draft.updateBookingByAdmin("token", id, {
      service_id: "manual-therapies",
      service_title: "Manual Therapies",
      tier_id: null,
      duration: "50 min",
      date: "2099-08-20",
      time: "11:00",
      location: "centro",
      location_address: null,
      notes: "moved",
      first_name: "Ana",
      last_name: "García",
      email: "ana@example.com",
      phone: null,
      status: "confirmed",
    });

  test("three days away: saved", async () => {
    expect(await edit(MINE)).toEqual({ error: null });
    expect(tables.bookings[0]!.notes).toBe("moved");
  });

  test.each([
    ["in 2 hours", 2 * HOUR],
    ["in 23 hours", 23 * HOUR],
    ["an hour ago", -HOUR],
  ])("%s: refused, and nothing is written", async (_label, ms) => {
    Object.assign(tables.bookings[0]!, canaryIn(ms));
    expect(await edit(MINE)).toEqual({ error: "partner_window" });
    expect(tables.bookings[0]!.notes).toBeUndefined();
  });

  test("judged on the booking as it stands, not on the day the save asks for", async () => {
    // Moving a session that starts in 2 hours to next year is still an edit
    // inside the window.
    Object.assign(tables.bookings[0]!, canaryIn(2 * HOUR));
    expect(await edit(MINE)).toEqual({ error: "partner_window" });
  });

  test("a booking with no day is editable, as on her screen", async () => {
    Object.assign(tables.bookings[0]!, { date: null, time: null });
    expect(await edit(MINE)).toEqual({ error: null });
  });

  test("staff and admin are not held to it", async () => {
    for (const r of ["staff", "admin"]) {
      role = r;
      Object.assign(tables.bookings[0]!, canaryIn(2 * HOUR));
      expect(await edit(MINE)).toEqual({ error: null });
    }
  });

  test("an id that is not one, or a booking that is not there, is refused", async () => {
    role = "admin";
    expect(await edit("1")).toEqual({ error: "invalid" });
    expect(await edit("aaaaaaaa-0000-4000-8000-00000000000f")).toEqual({
      error: "not_found",
    });
  });
});

const HER_CLIENT = "cccccccc-0000-4000-8000-000000000001";
const NOT_HERS = "cccccccc-0000-4000-8000-000000000002";

describe("what a partner may read of a booking and its client", () => {
  beforeEach(() => {
    tables.bookings[0]!.contact_id = HER_CLIENT;
    tables.bookings[1]!.contact_id = NOT_HERS;
    tables.contacts.push(
      { id: HER_CLIENT, email: "ana@example.com" },
      { id: NOT_HERS, email: "bea@example.com" },
    );
    tables.booking_events = [
      {
        id: "e-1",
        booking_id: MINE,
        summary: "mine",
        created_at: "2026-01-01",
      },
      {
        id: "e-2",
        booking_id: THEIRS,
        summary: "theirs",
        created_at: "2026-01-01",
      },
    ];
  });

  test("the history of her own booking, and of nobody else's", async () => {
    expect(
      (await events.fetchBookingEvents("token", MINE)).map((e) => e.summary),
    ).toEqual(["mine"]);
    expect(await events.fetchBookingEvents("token", THEIRS)).toEqual([]);
    expect(await events.fetchBookingEvents("token", "1")).toEqual([]);
  });

  test("staff read any booking's history", async () => {
    role = "staff";
    expect(
      (await events.fetchBookingEvents("token", THEIRS)).map((e) => e.summary),
    ).toEqual(["theirs"]);
  });

  test("the list of every contact is not hers", async () => {
    expect(await contacts.fetchContacts("token", 0, 20)).toEqual({
      contacts: [],
      total: 0,
    });
  });

  test("a client of hers she sees, with her own bookings only; any other contact is not found", async () => {
    // A second booking with her client, somebody else's: not shown to her.
    tables.bookings.push(
      booking({
        id: "aaaaaaaa-0000-4000-8000-000000000009",
        partner_id: SOMEONE,
        contact_id: HER_CLIENT,
      }),
    );
    const detail = await contacts.fetchContactDetail("token", HER_CLIENT);
    expect(detail.found).toBe(true);
    if (detail.found) {
      expect(detail.bookings.map((b) => b.id)).toEqual([MINE]);
      expect(detail.memberships).toEqual([]);
    }
    expect(await contacts.fetchContactDetail("token", NOT_HERS)).toEqual({
      found: false,
    });
  });

  test("a client of hers by the address alone, when the booking carries no contact", async () => {
    tables.bookings[0]!.contact_id = null;
    tables.bookings[0]!.email = "ANA@example.com";
    expect((await contacts.fetchContactDetail("token", HER_CLIENT)).found).toBe(
      true,
    );
  });

  test("a client's bonuses, only a client of hers", async () => {
    // Not a client of hers: nothing is read for her (the table is not even
    // in this database).
    expect(await bonuses.fetchContactBonuses("token", NOT_HERS)).toEqual([]);
  });

  test("staff and admin see every contact, with all its bookings", async () => {
    role = "admin";
    const detail = await contacts.fetchContactDetail("token", NOT_HERS);
    expect(detail.found).toBe(true);
    if (detail.found)
      expect(detail.bookings.map((b) => b.id)).toEqual([THEIRS]);
  });
});
