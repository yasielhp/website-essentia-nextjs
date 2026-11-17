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
import { bookingCancelledEmail } from "@/emails/templates/booking-cancelled";
import { bookingConfirmedEmail } from "@/emails/templates/booking-confirmed";
import { bookingReceivedEmail } from "@/emails/templates/booking-received";
import { bookingRescheduledEmail } from "@/emails/templates/booking-rescheduled";
import { formatLongDate } from "@/lib/format-date";
import type {
  BookingNotificationEvent,
  notifyBookingCore as NotifyCore,
} from "./notify";

/**
 * The real `notifyBookingCore`, with its edges replaced: the database, the
 * mailer, the booking history and the consent lookup. What it proves is the
 * promise that matters on a booking somebody has already paid for: with no
 * edited message — or with one that cannot be read — the client receives
 * exactly the email the legacy template builds, same subject, same HTML.
 *
 * The modules are put back afterwards: `mock.module` is process-wide, and
 * other test files import the real ones.
 */

type Sent = { to: string; subject: string; html: string };
type Recorded = { summary?: string; status?: string; channel?: string };

const CONSENT = "https://example.test/consent?token=c1";
const TOKEN = "tok-123";

let sent: Sent[] = [];
let recorded: Recorded[] = [];
// What the fake `message_templates` answers with.
let templates: () => { data: unknown; error: unknown } = () => ({
  data: null,
  error: null,
});

function chain(result: () => unknown): unknown {
  const handler: ProxyHandler<() => void> = {
    get(_t, prop) {
      if (prop === "then") {
        return (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => {
          try {
            return Promise.resolve(result()).then(ok, bad);
          } catch (err) {
            return Promise.reject(err).then(ok, bad);
          }
        };
      }
      return () => proxy;
    },
    apply: () => proxy,
  };
  const proxy: unknown = new Proxy(() => {}, handler);
  return proxy;
}

const fakeAdmin = {
  getAdminClient: () => ({
    database: {
      from: (table: string) =>
        chain(() => {
          if (table === "message_templates") return templates();
          if (table === "bookings") {
            return {
              data: {
                email: "ana@example.test",
                service_id: "svc-1",
                cancel_token: TOKEN,
              },
              error: null,
            };
          }
          return { data: null, error: null };
        }),
    },
  }),
};

const real = {
  admin: { ...(await import("@/lib/insforge-admin")) },
  send: { ...(await import("@/emails/send")) },
  record: { ...(await import("@/lib/booking-events/record")) },
  consent: { ...(await import("@/lib/consent/server")) },
};

let notifyBookingCore: typeof NotifyCore;

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
    recordBookingEvent: async (e: Recorded) => {
      recorded.push(e);
    },
  }));
  mock.module("@/lib/consent/server", () => ({
    ...real.consent,
    pendingConsentUrl: async () => CONSENT,
  }));
  ({ notifyBookingCore } = await import("./notify"));
});

afterAll(() => {
  mock.module("@/lib/insforge-admin", () => real.admin);
  mock.module("@/emails/send", () => real.send);
  mock.module("@/lib/booking-events/record", () => real.record);
  mock.module("@/lib/consent/server", () => real.consent);
});

beforeEach(() => {
  sent = [];
  recorded = [];
  templates = () => ({ data: null, error: null });
});

const EVENTS: BookingNotificationEvent[] = [
  "received",
  "confirmed",
  "rescheduled",
  "cancelled",
];

const SUBJECTS = {
  es: {
    received: "Solicitud de reserva recibida — Drenaje linfático",
    confirmed: "Tu reserva ha sido confirmada — Drenaje linfático",
    cancelled: "Reserva cancelada — Drenaje linfático",
    rescheduled: "Sesión reprogramada — Drenaje linfático",
  },
  en: {
    received: "Booking request received — Drenaje linfático",
    confirmed: "Booking confirmed — Drenaje linfático",
    cancelled: "Booking cancelled — Drenaje linfático",
    rescheduled: "Booking rescheduled — Drenaje linfático",
  },
} as const;

const payload = (event: BookingNotificationEvent, locale: "en" | "es") => ({
  bookingId: "b-1",
  event,
  clientName: "Ana García",
  clientEmail: "ignored@example.test",
  service: "Drenaje linfático",
  sessionType: "Sesión individual",
  date: "2026-08-20",
  time: "10:30",
  duration: "60 min",
  amountDueEur: event === "received" ? 45 : null,
  locale,
});

/** The email the legacy template builds for this payload, written out by hand. */
function legacyHtml(event: BookingNotificationEvent, locale: "en" | "es") {
  const cancelUrl =
    locale === "es"
      ? `https://app.example.test/es/reserva/cancelar?token=${TOKEN}`
      : `https://app.example.test/booking/cancel?token=${TOKEN}`;
  const common = {
    name: "Ana García",
    service: "Drenaje linfático",
    sessionType: "Sesión individual",
    date: formatLongDate("2026-08-20", locale),
    time: "10:30",
    duration: "60 min",
    locale,
  };
  switch (event) {
    case "received":
      return bookingReceivedEmail({ ...common, amountDueEur: 45, cancelUrl });
    case "confirmed":
      return bookingConfirmedEmail({
        ...common,
        dateIso: "2026-08-20",
        cancelUrl,
        consentUrl: CONSENT,
      });
    case "rescheduled":
      return bookingRescheduledEmail({
        ...common,
        dateIso: "2026-08-20",
        cancelUrl,
      });
    case "cancelled":
      return bookingCancelledEmail(common);
  }
}

const actor = { actorId: null, actorRole: "system" } as const;

/** The email to the client: the first one, before any email to staff. */
const clientEmail = () => sent[0]!;

describe("the client email with nothing edited is the legacy email, byte for byte", () => {
  for (const locale of ["es", "en"] as const) {
    for (const event of EVENTS) {
      test(`${event}/${locale}: no saved row`, async () => {
        await notifyBookingCore(payload(event, locale), actor);
        expect(sent).toHaveLength(1);
        expect(clientEmail().to).toBe("ana@example.test");
        expect(clientEmail().subject).toBe(SUBJECTS[locale][event]);
        expect(clientEmail().html).toBe(legacyHtml(event, locale));
        expect(recorded[0]?.summary).toBe(SUBJECTS[locale][event]);
      });

      test(`${event}/${locale}: the database cannot be read`, async () => {
        const quiet = spyOn(console, "error").mockImplementation(() => {});
        templates = () => {
          throw new Error("db down");
        };
        await notifyBookingCore(payload(event, locale), actor);
        quiet.mockRestore();
        expect(sent).toHaveLength(1);
        expect(clientEmail().subject).toBe(SUBJECTS[locale][event]);
        expect(clientEmail().html).toBe(legacyHtml(event, locale));
      });

      test(`${event}/${locale}: the lookup answers with an error`, async () => {
        const quiet = spyOn(console, "error").mockImplementation(() => {});
        templates = () => ({ data: null, error: { message: "nope" } });
        await notifyBookingCore(payload(event, locale), actor);
        quiet.mockRestore();
        expect(clientEmail().subject).toBe(SUBJECTS[locale][event]);
        expect(clientEmail().html).toBe(legacyHtml(event, locale));
      });
    }
  }
});

describe("an edited message is what the client receives", () => {
  const edited = {
    subject: "Asunto del centro para {{first_name}}",
    preheader: null,
    title: "Título {{first_name}}",
    doc: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Texto del centro sobre {{service}}." },
          ],
        },
      ],
    },
    enabled: true,
  };

  for (const event of EVENTS) {
    test(`${event}: the custom subject and body go out and are recorded`, async () => {
      templates = () => ({ data: edited, error: null });
      await notifyBookingCore(payload(event, "es"), actor);
      expect(clientEmail().subject).toBe("Asunto del centro para Ana García");
      expect(clientEmail().html).toContain(
        "Texto del centro sobre Drenaje linfático.",
      );
      expect(clientEmail().html).toContain("Detalles de la sesión");
      expect(clientEmail().html).not.toBe(legacyHtml(event, "es"));
      // The history shows what the client saw in their inbox.
      expect(recorded[0]?.summary).toBe("Asunto del centro para Ana García");
    });
  }

  test("a switched-off confirmation still goes out: only the reminder can be off", async () => {
    templates = () => ({ data: { ...edited, enabled: false }, error: null });
    await notifyBookingCore(payload("confirmed", "es"), actor);
    expect(sent).toHaveLength(1);
    expect(clientEmail().subject).toBe("Asunto del centro para Ana García");
  });
});
