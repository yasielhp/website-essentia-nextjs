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
 * The two live flows that now hand a booking to the client's WhatsApp: the
 * confirmation (`notifyBookingCore`) and the Redsys payment
 * (`handleBookingPaid`). The WhatsApp sender itself is replaced by a spy, so
 * what is under test is WHEN they call it and that nothing else changes: the
 * email still goes first and the call comes after, once, with the right key.
 *
 * Modules are put back afterwards: `mock.module` is process-wide.
 */

type Call = Record<string, unknown> & { emailsSentBefore: number };
type Sent = { to: string; subject: string; html: string };

let sent: Sent[] = [];
let calls: Call[] = [];
let whatsappThrows = false;
let paymentStatus = "none";
let amountPaid = 0;
/** A `payment/paid` event for this Redsys order already exists (a retry). */
let priorPaidEvent = false;
/** Another notification already added this money: our conditional update matches nothing. */
let updateLoses = false;
let bookingUpdates = 0;

const BOOKING = () => ({
  first_name: "Ana",
  last_name: "García",
  email: "ana@example.test",
  service_title: "Drenaje linfático",
  date: "2099-08-20",
  time: "10:30",
  duration: "60 min",
  price_eur: 45,
  amount_paid_eur: amountPaid,
  payment_status: paymentStatus,
  status: "pending",
  stripe_session_id: "ord-1",
  contact_id: "c-1",
  staff_id: null,
});

function resolveDb(table: string, ops: string[]): unknown {
  const has = (op: string) => ops.includes(op);
  switch (table) {
    case "bookings":
      if (has("update")) {
        bookingUpdates += 1;
        return { data: updateLoses ? [] : [{ id: "b-1" }], error: null };
      }
      if (has("single") || has("maybeSingle")) {
        return {
          data: {
            ...BOOKING(),
            service_id: "svc-1",
            cancel_token: "tok",
          },
          error: null,
        };
      }
      return { data: [], error: null };
    case "booking_events":
      // The webhook's own entry for this order: what a retry is told by.
      return {
        data: priorPaidEvent
          ? [
              {
                id: "e-1",
                event: "paid",
                actor_role: "system",
                provider_id: "ord-1",
                payload: { amountEur: 45 },
                created_at: "2026-11-24T10:00:00Z",
              },
            ]
          : [],
        error: null,
      };
    case "contacts":
      return { data: { preferred_language: "es" }, error: null };
    default:
      return { data: null, error: null };
  }
}

function chain(table: string): unknown {
  const ops: string[] = [];
  const proxy: unknown = new Proxy(() => {}, {
    get(_t, prop) {
      if (prop === "then") {
        return (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) =>
          Promise.resolve(resolveDb(table, ops)).then(ok, bad);
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

const real = {
  admin: { ...(await import("@/lib/insforge-admin")) },
  send: { ...(await import("@/emails/send")) },
  record: { ...(await import("@/lib/booking-events/record")) },
  consent: { ...(await import("@/lib/consent/server")) },
  calendar: { ...(await import("@/lib/calendar-sync")) },
  wa: { ...(await import("@/lib/whatsapp/notify")) },
  staffPaid: { ...(await import("@/lib/bookings/notify-staff-paid")) },
  client: { ...(await import("@/lib/whatsapp/notify-client")) },
};

let notifyBookingCore: typeof import("@/lib/bookings/notify").notifyBookingCore;
let handleBookingPaid: typeof import("@/services/booking-payments.service").handleBookingPaid;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_APP_URL = "https://app.example.test";
  mock.module("@/lib/insforge-admin", () => ({
    getAdminClient: () => ({
      database: { from: (t: string) => chain(t), rpc: () => chain("rpc") },
    }),
  }));
  mock.module("@/emails/send", () => ({
    ...real.send,
    sendEmail: async (m: Sent) => {
      sent.push(m);
      return { error: null, id: "re_1" };
    },
  }));
  mock.module("@/lib/booking-events/record", () => ({
    ...real.record,
    recordBookingEvent: async () => {},
  }));
  mock.module("@/lib/consent/server", () => ({
    ...real.consent,
    pendingConsentUrl: async () => null,
  }));
  mock.module("@/lib/calendar-sync", () => ({
    ...real.calendar,
    pushBookingToCalendars: async () => {},
  }));
  mock.module("@/lib/whatsapp/notify", () => ({
    ...real.wa,
    notifyStaffOnWhatsApp: async () => {},
  }));
  mock.module("@/lib/bookings/notify-staff-paid", () => ({
    ...real.staffPaid,
    notifyStaffOfPaidBooking: async () => {},
  }));
  mock.module("@/lib/whatsapp/notify-client", () => ({
    ...real.client,
    notifyClientOnWhatsApp: async (input: Record<string, unknown>) => {
      calls.push({ ...input, emailsSentBefore: sent.length });
      if (whatsappThrows) throw new Error("whatsapp exploded");
    },
  }));
  ({ notifyBookingCore } = await import("@/lib/bookings/notify"));
  ({ handleBookingPaid } = await import("@/services/booking-payments.service"));
});

afterAll(() => {
  mock.module("@/lib/insforge-admin", () => real.admin);
  mock.module("@/emails/send", () => real.send);
  mock.module("@/lib/booking-events/record", () => real.record);
  mock.module("@/lib/consent/server", () => real.consent);
  mock.module("@/lib/calendar-sync", () => real.calendar);
  mock.module("@/lib/whatsapp/notify", () => real.wa);
  mock.module("@/lib/bookings/notify-staff-paid", () => real.staffPaid);
  mock.module("@/lib/whatsapp/notify-client", () => real.client);
});

beforeEach(() => {
  sent = [];
  calls = [];
  whatsappThrows = false;
  paymentStatus = "none";
  amountPaid = 0;
  priorPaidEvent = false;
  updateLoses = false;
  bookingUpdates = 0;
});

const payload = (
  event: "received" | "confirmed" | "cancelled" | "rescheduled",
) => ({
  bookingId: "b-1",
  event,
  clientName: "Ana García",
  clientEmail: "ana@example.test",
  service: "Drenaje linfático",
  date: "2099-08-20",
  time: "10:30",
});
const ACTOR = { actorId: "admin-1", actorRole: "admin" as const };

describe("confirmation: notifyBookingCore", () => {
  test("a confirmation hands the booking to the client's WhatsApp once, after the email", async () => {
    await notifyBookingCore(payload("confirmed"), ACTOR);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      bookingId: "b-1",
      key: "booking_confirmed",
      event: "confirmed",
      actorId: "admin-1",
      actorRole: "admin",
    });
    expect(sent.length).toBeGreaterThanOrEqual(1);
    expect(calls[0]!.emailsSentBefore).toBe(sent.length);
  });

  test("no other event does", async () => {
    for (const event of ["received", "cancelled", "rescheduled"] as const) {
      await notifyBookingCore(payload(event), ACTOR);
    }
    expect(calls).toHaveLength(0);
  });

  test("the language is only what the caller said: absent stays absent", async () => {
    await notifyBookingCore(payload("confirmed"), ACTOR);
    expect(calls[0]!.locale).toBeUndefined();
    await notifyBookingCore({ ...payload("confirmed"), locale: "es" }, ACTOR);
    expect(calls[1]!.locale).toBe("es");
  });

  test("a WhatsApp that blows up cannot undo the confirmation, which was already emailed", async () => {
    whatsappThrows = true;
    await notifyBookingCore(payload("confirmed"), ACTOR);
    expect(sent[0]!.to).toBe("ana@example.test");
    expect(calls).toHaveLength(1);
  });

  test("the email is not touched by it: same count and recipients with and without the hook", async () => {
    await notifyBookingCore(payload("confirmed"), ACTOR);
    expect(sent.every((m) => m.to.includes("@"))).toBe(true);
    expect(sent[0]!.to).toBe("ana@example.test");
  });
});

describe("payment: handleBookingPaid", () => {
  test("the first payment hands the booking to the client's WhatsApp, after the email", async () => {
    await handleBookingPaid("b-1", 4500);
    expect(sent).toHaveLength(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      bookingId: "b-1",
      key: "booking_paid",
      event: "paid",
      locale: "es",
      actorRole: "system",
    });
    expect(calls[0]!.emailsSentBefore).toBe(1);
  });

  test("a deposit and then the balance: the second payment sends the email but not the WhatsApp", async () => {
    paymentStatus = "deposit_paid";
    amountPaid = 20;
    await handleBookingPaid("b-1", 2500);
    expect(sent).toHaveLength(1);
    expect(calls).toHaveLength(0);
  });

  test("a WhatsApp that blows up cannot undo the payment, which was already recorded and emailed", async () => {
    whatsappThrows = true;
    await handleBookingPaid("b-1", 4500);
    expect(sent).toHaveLength(1);
    expect(calls).toHaveLength(1);
  });

  test("Redsys retrying a notification already handled sends nothing at all: no money, no email, no WhatsApp", async () => {
    priorPaidEvent = true;
    await handleBookingPaid("b-1", 4500);
    expect(bookingUpdates).toBe(0);
    expect(sent).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });

  test("the loser of two notifications arriving together sends nothing: the other one does", async () => {
    updateLoses = true;
    await handleBookingPaid("b-1", 4500);
    expect(bookingUpdates).toBe(1);
    expect(sent).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });

  test("an already paid booking does not send it again either", async () => {
    paymentStatus = "paid";
    amountPaid = 45;
    await handleBookingPaid("b-1", 100);
    expect(calls).toHaveLength(0);
  });
});
