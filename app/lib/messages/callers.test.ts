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
import { bonusPurchaseEmail } from "@/emails/templates/bonus-purchase";
import { bookingCancelledEmail } from "@/emails/templates/booking-cancelled";
import { bookingConfirmationEmail } from "@/emails/templates/booking-confirmation";
import { consentRequestEmail } from "@/emails/templates/consent-request";
import { bonusExpiry, bonusToday } from "@/lib/bonuses/expiry";
import { formatLongDate as longDateWithWeekday } from "@/lib/format-date";
import { formatLongDate, formatPrice } from "@/utils/format";

/**
 * The four remaining places that send a client email, run for real with their
 * edges replaced: the self-service cancellation, the consent request, the
 * paid-booking confirmation and the voucher confirmation. With nothing edited,
 * or with an edited message that cannot be read, what reaches the mailer is
 * what the legacy template builds, subject and HTML, byte for byte.
 *
 * Modules are put back afterwards: `mock.module` is process-wide.
 */

type Sent = { to: string; subject: string; html: string };
type Ctx = { table: string; ops: string[] };

let sent: Sent[] = [];
let recorded: {
  summary?: string;
  status?: string;
  channel?: string;
  event?: string;
  error?: string | null;
  bookingId?: string;
}[] = [];
let templates: () => { data: unknown; error: unknown } = () => ({
  data: null,
  error: null,
});
let bookingRow: Record<string, unknown> = {};
let contactRow: Record<string, unknown> = {};
let orderRow: Record<string, unknown> = {};

function resolveDb({ table, ops }: Ctx): unknown {
  const has = (op: string) => ops.includes(op);
  switch (table) {
    case "message_templates":
      return templates();
    case "bookings":
      if (has("update")) return { data: [{ id: "b-1" }], error: null };
      return has("single") || has("maybeSingle")
        ? { data: bookingRow, error: null }
        : { data: [bookingRow], error: null };
    case "booking_events":
      return { data: [], error: null };
    case "contacts":
      return has("upsert")
        ? { data: null, error: null }
        : { data: contactRow, error: null };
    case "contact_consents":
      return {
        data: { token: "c".repeat(32), signed_at: null },
        error: null,
      };
    case "bonus_orders":
      return has("update")
        ? { data: [{ id: "o-1" }], error: null }
        : { data: orderRow, error: null };
    case "service_tiers":
      return { data: { label: "Sesión individual" }, error: null };
    case "contact_bonuses":
      return { data: { id: "cb-1" }, error: null };
    case "rpc":
      return { data: "contact-1", error: null };
    default:
      return { data: null, error: null };
  }
}

function chain(ctx: Ctx): unknown {
  const proxy: unknown = new Proxy(() => {}, {
    get(_t, prop) {
      if (prop === "then") {
        return (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => {
          try {
            return Promise.resolve(resolveDb(ctx)).then(ok, bad);
          } catch (err) {
            return Promise.reject(err).then(ok, bad);
          }
        };
      }
      return (...args: unknown[]) => {
        void args;
        ctx.ops.push(String(prop));
        return proxy;
      };
    },
    apply: () => proxy,
  });
  return proxy;
}

const fakeAdmin = {
  getAdminClient: () => ({
    database: {
      from: (table: string) => chain({ table, ops: [] }),
      rpc: () => chain({ table: "rpc", ops: [] }),
    },
  }),
};

const real = {
  admin: { ...(await import("@/lib/insforge-admin")) },
  send: { ...(await import("@/emails/send")) },
  record: { ...(await import("@/lib/booking-events/record")) },
  guard: { ...(await import("@/lib/auth-guard")) },
  consent: { ...(await import("@/lib/consent/server")) },
  calendar: { ...(await import("@/lib/calendar-sync")) },
  propagate: { ...(await import("@/lib/calendar-propagate")) },
  wa: { ...(await import("@/lib/whatsapp/notify")) },
  staffPaid: { ...(await import("@/lib/bookings/notify-staff-paid")) },
};

let cancelBookingByToken: typeof import("@/actions/booking-cancellation").cancelBookingByToken;
let sendConsentEmail: typeof import("@/actions/consent").sendConsentEmail;
let handleBookingPaid: typeof import("@/services/booking-payments.service").handleBookingPaid;
let handleBonusPaid: typeof import("@/services/bonus-payments.service").handleBonusPaid;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_APP_URL = "https://app.example.test";
  mock.module("@/lib/insforge-admin", () => fakeAdmin);
  mock.module("@/emails/send", () => ({
    ...real.send,
    sendEmail: async (m: Sent) => {
      sent.push(m);
      return { error: null, id: "re_1" };
    },
  }));
  mock.module("@/lib/booking-events/record", () => ({
    ...real.record,
    recordBookingEvent: async (e: { summary?: string }) => {
      recorded.push(e);
    },
  }));
  mock.module("@/lib/auth-guard", () => ({
    ...real.guard,
    requireRole: async () => ({ id: "admin-1" }),
  }));
  mock.module("@/lib/consent/server", () => ({
    ...real.consent,
    pendingConsentUrl: async () => "https://example.test/consent?token=c1",
  }));
  mock.module("@/lib/calendar-sync", () => ({
    ...real.calendar,
    pushBookingToCalendars: async () => {},
  }));
  mock.module("@/lib/calendar-propagate", () => ({
    ...real.propagate,
    removeBookingFromCalendars: async () => {},
  }));
  mock.module("@/lib/whatsapp/notify", () => ({
    ...real.wa,
    notifyStaffOnWhatsApp: async () => {},
  }));
  mock.module("@/lib/bookings/notify-staff-paid", () => ({
    ...real.staffPaid,
    notifyStaffOfPaidBooking: async () => {},
  }));
  ({ cancelBookingByToken } = await import("@/actions/booking-cancellation"));
  ({ sendConsentEmail } = await import("@/actions/consent"));
  ({ handleBookingPaid } = await import("@/services/booking-payments.service"));
  ({ handleBonusPaid } = await import("@/services/bonus-payments.service"));
});

afterAll(() => {
  mock.module("@/lib/insforge-admin", () => real.admin);
  mock.module("@/emails/send", () => real.send);
  mock.module("@/lib/booking-events/record", () => real.record);
  mock.module("@/lib/auth-guard", () => real.guard);
  mock.module("@/lib/consent/server", () => real.consent);
  mock.module("@/lib/calendar-sync", () => real.calendar);
  mock.module("@/lib/calendar-propagate", () => real.propagate);
  mock.module("@/lib/whatsapp/notify", () => real.wa);
  mock.module("@/lib/bookings/notify-staff-paid", () => real.staffPaid);
});

beforeEach(() => {
  sent = [];
  recorded = [];
  templates = () => ({ data: null, error: null });
});

const edited = (text: string) => ({
  subject: "Asunto del centro para {{first_name}}",
  preheader: null,
  title: null,
  doc: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  },
  enabled: true,
});

/** Each scenario: nothing saved, a database that fails, a lookup that errors. */
const UNEDITED: [string, () => { data: unknown; error: unknown }][] = [
  ["no saved row", () => ({ data: null, error: null })],
  [
    "the database cannot be read",
    () => {
      throw new Error("db down");
    },
  ],
  [
    "the lookup answers with an error",
    () => ({ data: null, error: { message: "x" } }),
  ],
];

const LOCALES = ["es", "en"] as const;
const FUTURE = "2099-08-20";

// ── cancellation from the email link ───────────────────────────────────────

describe("cancellation by link (booking_cancelled)", () => {
  beforeEach(() => {
    bookingRow = {
      id: "b-1",
      service_id: "svc-1",
      service_title: "Drenaje linfático",
      date: FUTURE,
      time: "10:30",
      duration: "60 min",
      status: "confirmed",
      first_name: "Ana",
      last_name: "García",
      email: "ana@example.test",
      staff_id: null,
      service_tiers: { label: "Sesión individual" },
    };
  });

  for (const locale of LOCALES) {
    for (const [label, answer] of UNEDITED) {
      test(`${locale}: ${label} sends the legacy email`, async () => {
        const quiet = spyOn(console, "error").mockImplementation(() => {});
        templates = answer;
        const res = await cancelBookingByToken("tok", locale);
        quiet.mockRestore();
        expect(res.ok).toBe(true);
        expect(sent).toHaveLength(1);
        // The subject is Spanish whatever the language of the email.
        expect(sent[0]!.subject).toBe("Reserva cancelada — Drenaje linfático");
        expect(sent[0]!.html).toBe(
          bookingCancelledEmail({
            name: "Ana",
            service: "Drenaje linfático",
            sessionType: "Sesión individual",
            date: longDateWithWeekday(FUTURE, locale),
            time: "10:30",
            duration: "60 min",
            locale,
          }),
        );
      });
    }
  }

  test("an edited message goes out, and the history shows its subject", async () => {
    templates = () => ({
      data: edited("Cancelada: {{service}}."),
      error: null,
    });
    await cancelBookingByToken("tok", "es");
    expect(sent[0]!.subject).toBe("Asunto del centro para Ana");
    expect(sent[0]!.html).toContain("Cancelada: Drenaje linfático.");
    expect(recorded.at(-1)?.summary).toBe("Asunto del centro para Ana");
  });
});

// ── consent request ────────────────────────────────────────────────────────

describe("consent request (consent_request)", () => {
  for (const locale of LOCALES) {
    beforeEach(() => {
      contactRow = {
        email: "ana@example.test",
        first_name: " Ana ",
        preferred_language: locale === "en" ? "en" : "es",
      };
    });
    for (const [label, answer] of UNEDITED) {
      test(`${locale}: ${label} sends the legacy email`, async () => {
        contactRow = {
          email: "ana@example.test",
          first_name: " Ana ",
          preferred_language: locale,
        };
        const quiet = spyOn(console, "error").mockImplementation(() => {});
        templates = answer;
        const res = await sendConsentEmail("token", "contact-1");
        quiet.mockRestore();
        expect(res.error).toBeNull();
        expect(sent).toHaveLength(1);
        expect(sent[0]!.subject).toBe(
          locale === "es"
            ? "Completa tu consentimiento informado · Essentia"
            : "Complete your informed consent · Essentia",
        );
        const url =
          locale === "es"
            ? `https://app.example.test/es/consentimiento/${"c".repeat(32)}`
            : `https://app.example.test/consent/${"c".repeat(32)}`;
        expect(sent[0]!.html).toBe(
          consentRequestEmail({ name: "Ana", url, locale }),
        );
      });
    }
  }

  test("an edited message goes out with the link block after it", async () => {
    contactRow = {
      email: "ana@example.test",
      first_name: "Ana",
      preferred_language: "es",
    };
    templates = () => ({ data: edited("Texto del centro."), error: null });
    await sendConsentEmail("token", "contact-1");
    expect(sent[0]!.subject).toBe("Asunto del centro para Ana");
    expect(sent[0]!.html).toContain("Texto del centro.");
    expect(sent[0]!.html).toContain("Rellenar consentimiento");
  });
});

// ── paid booking ───────────────────────────────────────────────────────────

describe("paid booking confirmation (booking_paid)", () => {
  const cases = [
    { name: "paid in full", cents: 4500, paid: 45, owed: 0 },
    { name: "deposit", cents: 2000, paid: 20, owed: 25 },
  ];

  beforeEach(() => {
    bookingRow = {
      first_name: "Ana",
      last_name: "García",
      email: "ana@example.test",
      service_title: "Drenaje linfático",
      date: FUTURE,
      time: "10:30",
      duration: "60 min",
      price_eur: 45,
      amount_paid_eur: 0,
      payment_status: "pending",
      status: "pending",
      stripe_session_id: null,
      contact_id: "contact-1",
      staff_id: null,
    };
  });

  for (const locale of LOCALES) {
    for (const c of cases) {
      for (const [label, answer] of UNEDITED) {
        test(`${locale}, ${c.name}: ${label} sends the legacy email`, async () => {
          contactRow = { preferred_language: locale };
          const quiet = spyOn(console, "error").mockImplementation(() => {});
          templates = answer;
          await handleBookingPaid("b-1", c.cents);
          quiet.mockRestore();
          expect(sent).toHaveLength(1);
          expect(sent[0]!.subject).toBe(
            locale === "es"
              ? "Tu reserva en Essentia está confirmada"
              : "Your Essentia booking is confirmed",
          );
          expect(sent[0]!.html).toBe(
            bookingConfirmationEmail({
              name: "Ana",
              serviceName: "Drenaje linfático",
              date: formatLongDate(FUTURE, locale),
              time: "10:30",
              duration: "60 min",
              dateIso: FUTURE,
              locale,
              paidEur: c.paid,
              owedEur: c.owed,
              consentUrl: "https://example.test/consent?token=c1",
            }),
          );
        });
      }
    }
  }

  test("an edited message goes out in the paid confirmation's own shell", async () => {
    contactRow = { preferred_language: "es" };
    templates = () => ({
      data: edited("Pagado: {{amount_paid}}."),
      error: null,
    });
    await handleBookingPaid("b-1", 2000);
    expect(sent[0]!.subject).toBe("Asunto del centro para Ana");
    expect(sent[0]!.html).toContain(formatPrice(20, "es"));
    expect(sent[0]!.html).toContain(">ESSENTIA</span>");
    expect(sent[0]!.html).toContain("Pendiente de pago en el centro");
  });
});

// ── voucher ────────────────────────────────────────────────────────────────

describe("voucher confirmation (bonus_purchase)", () => {
  for (const locale of LOCALES) {
    for (const [label, answer] of UNEDITED) {
      test(`${locale}: ${label} sends the legacy email`, async () => {
        orderRow = {
          id: "o-1",
          tier_id: "t-1",
          plan_id: "p-1",
          sessions: 5,
          price_eur: 180,
          validity_days: 365,
          first_name: "Ana",
          last_name: "García",
          email: "ana@example.test",
          phone: "+34600000000",
          preferred_language: locale,
          status: "pending",
        };
        const quiet = spyOn(console, "error").mockImplementation(() => {});
        templates = answer;
        await handleBonusPaid("order-1", 18000);
        quiet.mockRestore();
        expect(sent).toHaveLength(1);
        expect(sent[0]!.subject).toBe(
          locale === "es"
            ? "Tu bono de 5 sesiones está confirmado"
            : "Your 5-session voucher is confirmed",
        );
        expect(sent[0]!.html).toBe(
          bonusPurchaseEmail({
            name: "Ana",
            service: "Sesión individual",
            sessions: 5,
            amount: formatPrice(180, locale),
            expiresOn: formatLongDate(bonusExpiry(bonusToday(), 365), locale),
            locale,
          }),
        );
      });
    }
  }

  test("an edited message goes out with the voucher card after it", async () => {
    orderRow = {
      id: "o-1",
      tier_id: "t-1",
      plan_id: "p-1",
      sessions: 5,
      price_eur: 180,
      validity_days: 365,
      first_name: "Ana",
      last_name: "García",
      email: "ana@example.test",
      phone: "+34600000000",
      preferred_language: "es",
      status: "pending",
    };
    templates = () => ({
      data: edited("Tu bono de {{sessions}} sesiones."),
      error: null,
    });
    await handleBonusPaid("order-1", 18000);
    expect(sent[0]!.subject).toBe("Asunto del centro para Ana");
    expect(sent[0]!.html).toContain("Tu bono de 5 sesiones.");
    expect(sent[0]!.html).toContain("Importe pagado");
  });
});

// ── a message switched off, for every caller ───────────────────────────────

/** What the fake `message_templates` answers for a message that is switched off, with or without a text of its own. */
const OFF = [
  [
    "with a text of its own",
    () => ({ data: { ...edited("Texto."), enabled: false }, error: null }),
  ],
  [
    "with no text",
    () => ({
      data: {
        subject: null,
        preheader: null,
        title: null,
        doc: null,
        enabled: false,
      },
      error: null,
    }),
  ],
] as const;

describe("a message that is switched off sends nothing, throws nothing and says so", () => {
  describe("cancellation by link", () => {
    beforeEach(() => {
      bookingRow = {
        id: "b-1",
        service_id: "svc-1",
        service_title: "Drenaje linfático",
        date: FUTURE,
        time: "10:30",
        duration: "60 min",
        status: "confirmed",
        first_name: "Ana",
        last_name: "García",
        email: "ana@example.test",
        staff_id: null,
        service_tiers: { label: "Sesión individual" },
      };
    });
    for (const [label, answer] of OFF) {
      test(`${label}: the booking is still cancelled, no email, and the history has the entry`, async () => {
        templates = answer;
        const res = await cancelBookingByToken("tok", "es");
        expect(res.ok).toBe(true);
        expect(sent).toHaveLength(0);
        const note = recorded.find((e) => e.status === "skipped");
        expect(note).toMatchObject({
          bookingId: "b-1",
          channel: "email",
          event: "cancelled",
          error: "message_off",
        });
        expect(note?.summary).toContain("apagado");
      });
    }
  });

  describe("consent request, sent by a person", () => {
    beforeEach(() => {
      contactRow = {
        email: "ana@example.test",
        first_name: "Ana",
        preferred_language: "es",
      };
    });
    for (const [label, answer] of OFF) {
      test(`${label}: it answers with a clear error, sends nothing and does not pretend`, async () => {
        templates = answer;
        const res = await sendConsentEmail("token", "contact-1");
        expect(res).toEqual({ error: "message_off" });
        expect(sent).toHaveLength(0);
      });
    }
    test("the switch that cannot be read does not stop it: it is sent", async () => {
      const quiet = spyOn(console, "error").mockImplementation(() => {});
      templates = () => {
        throw new Error("db down");
      };
      const res = await sendConsentEmail("token", "contact-1");
      quiet.mockRestore();
      expect(res.error).toBeNull();
      expect(sent).toHaveLength(1);
    });
  });

  describe("paid booking confirmation", () => {
    beforeEach(() => {
      bookingRow = {
        first_name: "Ana",
        last_name: "García",
        email: "ana@example.test",
        service_title: "Drenaje linfático",
        date: FUTURE,
        time: "10:30",
        duration: "60 min",
        price_eur: 45,
        amount_paid_eur: 0,
        payment_status: "pending",
        status: "pending",
        stripe_session_id: null,
        contact_id: "contact-1",
        staff_id: null,
      };
      contactRow = { preferred_language: "es" };
    });
    for (const [label, answer] of OFF) {
      test(`${label}: the payment is still handled, no email, and the history has the entry`, async () => {
        templates = answer;
        await handleBookingPaid("b-1", 4500);
        expect(sent).toHaveLength(0);
        const note = recorded.find((e) => e.status === "skipped");
        expect(note).toMatchObject({
          bookingId: "b-1",
          channel: "email",
          event: "paid",
          error: "message_off",
        });
        expect(note?.summary).toContain("apagado");
        // The payment itself is in the history as always.
        expect(recorded.some((e) => e.channel === "payment")).toBe(true);
      });
    }
  });

  describe("voucher confirmation", () => {
    beforeEach(() => {
      orderRow = {
        id: "o-1",
        tier_id: "t-1",
        plan_id: "p-1",
        sessions: 5,
        price_eur: 180,
        validity_days: 365,
        first_name: "Ana",
        last_name: "García",
        email: "ana@example.test",
        phone: "+34600000000",
        preferred_language: "es",
        status: "pending",
      };
    });
    for (const [label, answer] of OFF) {
      test(`${label}: no email, no throw, and a warning is logged (a voucher has no booking history)`, async () => {
        templates = answer;
        const warn = spyOn(console, "warn").mockImplementation(() => {});
        await handleBonusPaid("order-1", 18000);
        const logged = warn.mock.calls.map((c) => String(c[0]));
        warn.mockRestore();
        expect(sent).toHaveLength(0);
        expect(
          logged.some((l) => l.includes("bonus_purchase") && l.includes("off")),
        ).toBe(true);
      });
    }
  });
});
