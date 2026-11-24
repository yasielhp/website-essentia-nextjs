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
} from "@/lib/bookings/fake-bookings-db";

/**
 * The real `handleBookingPaid` when the money arrives for a booking that did
 * not hold its hour (a draft paid directly, or one the cron released as
 * unpaid) and the hour is now another booking's: the database refuses to
 * confirm it onto that hour (`bookings_no_overlap`, kept by the in-memory
 * copy). The money must STILL be recorded, the booking left unconfirmed, the
 * history say why, the office be told, and the client not be sent a
 * confirmation for an hour she does not have.
 *
 * Modules are put back afterwards: `mock.module` is process-wide.
 */

const STAFF = "33333333-3333-4333-8333-333333333333";
const BOOKING = "88888888-8888-4888-8888-888888888888";

let tables: FakeTables;
let history: {
  channel: string;
  event: string;
  summary: string;
  payload?: unknown;
}[] = [];
let told: string[] = [];

const real = {
  admin: { ...(await import("@/lib/insforge-admin")) },
  send: { ...(await import("@/emails/send")) },
  record: { ...(await import("@/lib/booking-events/record")) },
  consent: { ...(await import("@/lib/consent/server")) },
  calendar: { ...(await import("@/lib/calendar-sync")) },
  wa: { ...(await import("@/lib/whatsapp/notify")) },
  waClient: { ...(await import("@/lib/whatsapp/notify-client")) },
  staffPaid: { ...(await import("@/lib/bookings/notify-staff-paid")) },
};
let handleBookingPaid: typeof import("./booking-payments.service").handleBookingPaid;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_APP_URL ??= "https://app.example.test";
  mock.module("@/lib/insforge-admin", () => ({
    ...real.admin,
    getAdminClient: () => ({ database: fakeBookingsDb(tables).db }),
  }));
  mock.module("@/emails/send", () => ({
    ...real.send,
    sendEmail: async (m: { to: string }) => {
      told.push(`email:${m.to}`);
      return { error: null, id: "re-1" };
    },
  }));
  mock.module("@/lib/booking-events/record", () => ({
    ...real.record,
    recordBookingEvent: async (e: (typeof history)[number]) => {
      history.push(e);
    },
  }));
  mock.module("@/lib/consent/server", () => ({
    ...real.consent,
    pendingConsentUrl: async () => null,
  }));
  mock.module("@/lib/calendar-sync", () => ({
    ...real.calendar,
    pushBookingToCalendars: async () => {
      told.push("calendars");
    },
  }));
  mock.module("@/lib/whatsapp/notify", () => ({
    ...real.wa,
    notifyStaffOnWhatsApp: async () => {
      told.push("professional");
    },
  }));
  mock.module("@/lib/whatsapp/notify-client", () => ({
    ...real.waClient,
    notifyClientOnWhatsApp: async () => {
      told.push("client-whatsapp");
    },
  }));
  mock.module("@/lib/bookings/notify-staff-paid", () => ({
    ...real.staffPaid,
    notifyStaffOfPaidBooking: async () => {
      told.push("office");
    },
  }));
  ({ handleBookingPaid } = await import("./booking-payments.service"));
});

afterAll(() => {
  mock.module("@/lib/insforge-admin", () => real.admin);
  mock.module("@/emails/send", () => real.send);
  mock.module("@/lib/booking-events/record", () => real.record);
  mock.module("@/lib/consent/server", () => real.consent);
  mock.module("@/lib/calendar-sync", () => real.calendar);
  mock.module("@/lib/whatsapp/notify", () => real.wa);
  mock.module("@/lib/whatsapp/notify-client", () => real.waClient);
  mock.module("@/lib/bookings/notify-staff-paid", () => real.staffPaid);
});

const paidFor = (status: string) => ({
  id: BOOKING,
  first_name: "Ana",
  last_name: "García",
  email: "ana@example.test",
  service_title: "Manual Therapies",
  date: "2099-08-20",
  time: "10:00",
  duration: "50 min",
  price_eur: 81,
  amount_paid_eur: 0,
  payment_status: "pending",
  payment_mode: "full",
  status,
  stripe_session_id: "o-1",
  balance_settled_method: null,
  contact_id: null,
  staff_id: STAFF,
});

const holder = {
  id: "held",
  status: "confirmed",
  staff_id: STAFF,
  date: "2099-08-20",
  time: "10:30",
  duration: "50 min",
  payment_status: "pending",
};

beforeEach(() => {
  history = [];
  told = [];
  tables = {
    bookings: [],
    service_tiers: [],
    staff_tiers: [],
    contacts: [],
    service_settings: [],
  };
});

const booking = () => tables.bookings.find((r) => r.id === BOOKING)!;

describe("money for an hour another booking holds", () => {
  test.each(["draft", "cancelled"])(
    "a %s booking: the money is recorded, it stays unconfirmed, the history says why and only the office is told",
    async (status) => {
      tables.bookings.push(paidFor(status), { ...holder });
      await handleBookingPaid(BOOKING, 8100, "o-1");
      expect(booking()).toMatchObject({
        status,
        payment_status: "paid",
        amount_paid_eur: 81,
        stripe_session_id: "o-1",
      });
      const paid = history.filter(
        (e) => e.channel === "payment" && e.event === "paid",
      );
      expect(paid).toHaveLength(1);
      expect(paid[0]!.summary).toContain(
        "la hora ya la tiene otra reserva de esta profesional",
      );
      expect(paid[0]!.payload).toMatchObject({ slotTaken: true });
      expect(told).toEqual(["office"]);
    },
  );

  test("Redsys repeating the notification records nothing more", async () => {
    tables.bookings.push(paidFor("draft"), { ...holder });
    await handleBookingPaid(BOOKING, 8100, "o-1");
    // The write is conditioned on the amount it read, as before: once.
    await handleBookingPaid(BOOKING, 8100, "o-1");
    expect(booking().amount_paid_eur).toBe(81);
  });
});

describe("money for an hour that is still free, as before", () => {
  test("the booking is confirmed, goes on the calendars and the client is told", async () => {
    tables.bookings.push(paidFor("pending"));
    await handleBookingPaid(BOOKING, 8100, "o-1");
    expect(booking()).toMatchObject({
      status: "confirmed",
      payment_status: "paid",
      amount_paid_eur: 81,
    });
    expect(told).toEqual([
      "calendars",
      "office",
      "professional",
      "email:ana@example.test",
      "client-whatsapp",
    ]);
    expect(history[0]!.summary).not.toContain("otra reserva");
  });
});
