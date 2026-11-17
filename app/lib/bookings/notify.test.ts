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
import type { notifyBooking as NotifyBooking } from "@/actions/booking-notifications";
import type {
  BookingNotificationEvent,
  readBookingNotification as ReadNotification,
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
let readBookingNotification: typeof ReadNotification;
// The Server Action, over the same fakes: what the public form really calls.
let notifyBooking: typeof NotifyBooking;

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
  ({ notifyBookingCore, readBookingNotification } = await import("./notify"));
  ({ notifyBooking } = await import("@/actions/booking-notifications"));
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

  for (const [locale, shown] of [
    ["es", "45\u00a0€"],
    ["en", "€45"],
  ] as const) {
    test(`received/${locale}: {{amount_due}} reads as the legacy email prints it`, async () => {
      templates = () => ({
        data: {
          ...edited,
          doc: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Pagarás {{amount_due}}." }],
              },
            ],
          },
        },
        error: null,
      });
      await notifyBookingCore(payload("received", locale), actor);
      expect(clientEmail().html).toContain(`Pagarás ${shown}.`);
      // And the legacy email shows the same amount in the same form.
      expect(legacyHtml("received", locale)).toContain(shown);
    });
  }

  test("a switched-off confirmation still goes out: only the reminder can be off", async () => {
    templates = () => ({ data: { ...edited, enabled: false }, error: null });
    await notifyBookingCore(payload("confirmed", "es"), actor);
    expect(sent).toHaveLength(1);
    expect(clientEmail().subject).toBe("Asunto del centro para Ana García");
  });
});

describe("the amount due is a number or it is nothing", () => {
  // The type says number; a Server Action's caller sends what it likes.
  const HOSTILE: [string, unknown][] = [
    ["an image tag", "<img src=x onerror=alert(1)>"],
    ["a number and a script", "45<script>alert(1)</script>"],
    ["a string that is not a plain number", "45.500,00"],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["a negative number", -5],
    ["an absurd number", 1e9],
    ["an object that prints as HTML", { toString: () => "<b>45</b>" }],
    ["an array", [45]],
    ["true", true],
  ];
  const withAmount = (amountDueEur: unknown, locale: "en" | "es") =>
    ({ ...payload("received", locale), amountDueEur }) as ReturnType<
      typeof payload
    >;
  const noAmount = (locale: "en" | "es") =>
    bookingReceivedEmail({
      name: "Ana García",
      service: "Drenaje linfático",
      sessionType: "Sesión individual",
      date: formatLongDate("2026-08-20", locale),
      time: "10:30",
      duration: "60 min",
      amountDueEur: null,
      cancelUrl:
        locale === "es"
          ? `https://app.example.test/es/reserva/cancelar?token=${TOKEN}`
          : `https://app.example.test/booking/cancel?token=${TOKEN}`,
      locale,
    });

  for (const locale of ["es", "en"] as const) {
    for (const [label, hostile] of HOSTILE) {
      test(`${locale}, legacy: ${label} is the email with no amount`, async () => {
        await notifyBookingCore(withAmount(hostile, locale), actor);
        expect(clientEmail().html).toBe(noAmount(locale));
      });

      test(`${locale}, edited: ${label} reaches neither the fixed block nor {{amount_due}}`, async () => {
        templates = () => ({
          data: {
            subject: "Asunto",
            preheader: null,
            title: null,
            doc: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Pagarás {{amount_due}}." }],
                },
              ],
            },
            enabled: true,
          },
          error: null,
        });
        await notifyBookingCore(withAmount(hostile, locale), actor);
        const { html } = clientEmail();
        expect(html).toContain("Pagarás.");
        expect(html).not.toContain("onerror");
        expect(html).not.toContain("<script");
        expect(html).not.toContain("<b>45");
        // The fixed block's sentence about paying at the centre is not there.
        expect(html).not.toContain("abonarás");
        expect(html).not.toContain("you will pay");
      });
    }
  }

  test("a number that arrived as text (a numeric column, a decimal comma) is the number", async () => {
    for (const [text, amount] of [
      ["45", 45],
      [" 45.50 ", 45.5],
      ["45,50", 45.5],
      ["0", 0],
    ] as const) {
      sent = [];
      await notifyBookingCore(withAmount(text, "es"), actor);
      expect(clientEmail().html).toBe(
        bookingReceivedEmail({
          name: "Ana García",
          service: "Drenaje linfático",
          sessionType: "Sesión individual",
          date: formatLongDate("2026-08-20", "es"),
          time: "10:30",
          duration: "60 min",
          amountDueEur: amount,
          cancelUrl: `https://app.example.test/es/reserva/cancelar?token=${TOKEN}`,
          locale: "es",
        }),
      );
    }
  });

  test("a real amount still reads as it always has, zero included", async () => {
    for (const amount of [45, 0, 37.5]) {
      sent = [];
      await notifyBookingCore(withAmount(amount, "es"), actor);
      expect(clientEmail().html).toBe(
        bookingReceivedEmail({
          name: "Ana García",
          service: "Drenaje linfático",
          sessionType: "Sesión individual",
          date: formatLongDate("2026-08-20", "es"),
          time: "10:30",
          duration: "60 min",
          amountDueEur: amount,
          cancelUrl: `https://app.example.test/es/reserva/cancelar?token=${TOKEN}`,
          locale: "es",
        }),
      );
      expect(clientEmail().html).toContain(`<strong>${amount}\u00a0€</strong>`);
    }
  });
});

describe("the Server Action checks what it is handed before anything is sent", () => {
  const ID = "3b7c1f6e-0d9a-4b52-8c1e-5a2f9d4e7b10";

  /** What the public booking form sends (`booking-submit.ts`). */
  const fromTheForm = (locale: "en" | "es" = "es") => ({
    bookingId: ID,
    event: "received" as const,
    clientName: "Ana García",
    clientEmail: "ana@example.test",
    clientPhone: null,
    service: "Drenaje linfático",
    serviceId: "lymphatic-drainage",
    sessionType: "Sesión individual",
    amountDueEur: null,
    date: "2026-08-20",
    time: "10:30",
    duration: "60 min",
    locale,
  });

  const legacyReceived = (
    locale: "en" | "es",
    amountDueEur: number | null = null,
  ) =>
    bookingReceivedEmail({
      name: "Ana García",
      service: "Drenaje linfático",
      sessionType: "Sesión individual",
      date: formatLongDate("2026-08-20", locale),
      time: "10:30",
      duration: "60 min",
      amountDueEur,
      cancelUrl:
        locale === "es"
          ? `https://app.example.test/es/reserva/cancelar?token=${TOKEN}`
          : `https://app.example.test/booking/cancel?token=${TOKEN}`,
      locale,
    });

  for (const locale of ["es", "en"] as const) {
    test(`${locale}: what the form sends goes out as the legacy email, byte for byte`, async () => {
      expect(await notifyBooking(null, fromTheForm(locale))).toEqual({
        ok: true,
      });
      expect(sent).toHaveLength(1);
      expect(clientEmail().to).toBe("ana@example.test");
      expect(clientEmail().subject).toBe(SUBJECTS[locale].received);
      expect(clientEmail().html).toBe(legacyReceived(locale));
    });
  }

  test("an amount that is a number goes through", async () => {
    await notifyBooking(null, { ...fromTheForm(), amountDueEur: 45 });
    expect(clientEmail().html).toBe(legacyReceived("es", 45));
  });

  test("the fields the form leaves empty are fine: no phone, no tier, no duration, no time", async () => {
    const out = await notifyBooking(null, {
      ...fromTheForm(),
      clientPhone: null,
      sessionType: null,
      duration: null,
      time: "",
    });
    expect(out).toEqual({ ok: true });
    expect(sent).toHaveLength(1);
  });

  // What cannot be repaired. Each is logged, with the path and the code of
  // what was wrong and nothing a client typed.
  const INVALID: [string, Record<string, unknown>, string][] = [
    ["a booking id that is not an id", { bookingId: "1 or 1=1" }, "bookingId"],
    ["no booking id", { bookingId: "" }, "bookingId"],
    ["an event nobody sends", { event: "paid" }, "event"],
    ["a service that is not text", { service: { title: "x" } }, "service"],
    ["a name that is not text", { clientName: ["Ana"] }, "clientName"],
    ["a session type that is not text", { sessionType: 7 }, "sessionType"],
    ["a time that is not text", { time: 1030 }, "time"],
    ["a duration that is not text", { duration: 60 }, "duration"],
    ["a date too long", { date: "2026-08-20".repeat(10) }, "date"],
    ["a date that is not text", { date: 20260820 }, "date"],
    // Nothing is left of it once cleaned: there is no service to write about.
    [
      "a service that is nothing but markup",
      { service: "<<>>\r\n" },
      "service",
    ],
    ["an empty service", { service: "" }, "service"],
  ];
  for (const [label, over, path] of INVALID) {
    test(`${label}: refused, nothing sent, nothing thrown, and it is logged`, async () => {
      const logged = spyOn(console, "error").mockImplementation(() => {});
      const out = await notifyBooking(null, {
        ...fromTheForm(),
        ...over,
      } as never);
      const lines = logged.mock.calls.map((call) => JSON.stringify(call));
      logged.mockRestore();
      expect(out).toEqual({ ok: false, error: "invalidInput" });
      expect(sent).toEqual([]);
      expect(recorded).toEqual([]);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain(`${path}: `);
      // Where and what kind, never whose: no name, address, phone or id.
      for (const personal of [
        "Ana",
        "ana@example.test",
        "Drenaje",
        ID,
        "1 or 1=1",
        "2026-08-20",
      ]) {
        expect(lines[0]).not.toContain(personal);
      }
    });
  }

  test("something that is not a payload at all is refused the same way", async () => {
    const logged = spyOn(console, "error").mockImplementation(() => {});
    for (const junk of [null, undefined, "received", 7, []]) {
      expect(await notifyBooking(null, junk as never)).toEqual({
        ok: false,
        error: "invalidInput",
      });
    }
    expect(logged).toHaveBeenCalledTimes(5);
    logged.mockRestore();
    expect(sent).toEqual([]);
  });

  // What used to be refused and can be repaired: a refusal is an email that
  // does not go out, and nobody is told.
  const REPAIRED: [string, Record<string, unknown>, number | null][] = [
    ["an amount that is a numeric string", { amountDueEur: "45" }, 45],
    ["an amount with a decimal comma", { amountDueEur: "45,50" }, 45.5],
    ["an amount that is HTML", { amountDueEur: "<img src=x>" }, null],
    ["an amount that is not finite", { amountDueEur: Infinity }, null],
    ["an amount that is NaN", { amountDueEur: Number.NaN }, null],
    ["a negative amount", { amountDueEur: -1 }, null],
    ["an absurd amount", { amountDueEur: 1e9 }, null],
    ["an amount that is an object", { amountDueEur: { eur: 45 } }, null],
    ["a phone far too long", { clientPhone: "6".repeat(500) }, null],
    ["a phone that is not text", { clientPhone: 600000000 }, null],
    ["a service id far too long", { serviceId: "s".repeat(500) }, null],
    ["a service id that is not text", { serviceId: 7 }, null],
    ["an address that is not text", { clientEmail: null }, null],
    ["an address far too long", { clientEmail: "a".repeat(999) }, null],
  ];
  for (const [label, over, amount] of REPAIRED) {
    test(`${label}: repaired, and the email goes out`, async () => {
      const logged = spyOn(console, "error").mockImplementation(() => {});
      const out = await notifyBooking(null, {
        ...fromTheForm(),
        ...over,
      } as never);
      expect(logged).not.toHaveBeenCalled();
      logged.mockRestore();
      expect(out).toEqual({ ok: true });
      expect(sent).toHaveLength(1);
      expect(clientEmail().subject).toBe(SUBJECTS.es.received);
      expect(clientEmail().html).toBe(legacyReceived("es", amount));
    });
  }

  test("a time or a date that is null, or missing, is an empty one", async () => {
    for (const over of [
      { time: null },
      { time: undefined },
      { date: null },
      { time: null, date: null },
    ]) {
      sent = [];
      const out = await notifyBooking(null, {
        ...fromTheForm(),
        ...over,
      } as never);
      expect(out).toEqual({ ok: true });
      expect(sent).toHaveLength(1);
      expect(clientEmail().html).toBe(
        received({
          ...("time" in over ? { time: "" } : {}),
          ...("date" in over ? { date: "" } : {}),
        }),
      );
    }
  });

  test("a language nobody writes in is no language: the email goes out in the default one", async () => {
    for (const locale of ["fr", "", 7, null]) {
      sent = [];
      const out = await notifyBooking(null, {
        ...fromTheForm(),
        locale,
      } as never);
      expect(out).toEqual({ ok: true });
      expect(clientEmail().subject).toBe(SUBJECTS.en.received);
      expect(clientEmail().html).toBe(legacyReceived("en"));
    }
  });

  test("a staff event with no session is turned away, as before", async () => {
    for (const event of ["confirmed", "cancelled", "rescheduled"] as const) {
      const out = await notifyBooking(null, { ...fromTheForm(), event });
      expect(out).toEqual({ ok: false, error: "unauthorized" });
    }
    expect(sent).toEqual([]);
  });

  // A stranger's text is cleaned and the email still goes: refusing would be
  // "send nothing", and a client must never be left without her email.
  const received = (over: Partial<ReturnType<typeof legacyArgs>>) =>
    bookingReceivedEmail({ ...legacyArgs(), ...over });
  const legacyArgs = () => ({
    name: "Ana García",
    service: "Drenaje linfático",
    sessionType: "Sesión individual" as string | null,
    date: formatLongDate("2026-08-20", "es"),
    time: "10:30",
    duration: "60 min" as string | null,
    amountDueEur: null,
    cancelUrl: `https://app.example.test/es/reserva/cancelar?token=${TOKEN}`,
    locale: "es" as const,
  });

  const CLEANED: [
    string,
    Record<string, unknown>,
    Partial<ReturnType<typeof legacyArgs>>,
  ][] = [
    [
      "HTML in the name",
      { clientName: "Ana <img src=x onerror=alert(1)>" },
      { name: "Ana img src=x onerror=alert(1)" },
    ],
    [
      "HTML in the service",
      { service: "<a href=https://evil.test>Paga aquí</a>" },
      { service: "a href=https://evil.testPaga aquí/a" },
    ],
    [
      "HTML in the session type",
      { sessionType: "<b>Sesión</b>" },
      { sessionType: "bSesión/b" },
    ],
    ["HTML in the time", { time: "<i>10:30</i>" }, { time: "i10:30/i" }],
    ["HTML in the duration", { duration: "60 min>" }, { duration: "60 min" }],
    [
      "a line break in the name",
      { clientName: "  Ana\r\n\tGarcía  " },
      { name: "Ana García" },
    ],
    [
      "a name of ten thousand characters",
      { clientName: "a".repeat(10_000) },
      { name: "a".repeat(200) },
    ],
    [
      "a session type, a time and a duration far too long",
      {
        sessionType: "s".repeat(500),
        time: "1".repeat(500),
        duration: "6".repeat(500),
      },
      {
        sessionType: "s".repeat(200),
        time: "1".repeat(20),
        duration: "6".repeat(40),
      },
    ],
    // Nothing to clean: not a byte is touched, odd spacing included.
    [
      "a name with spaces of its own",
      { clientName: " Ana  María  García " },
      { name: " Ana  María  García " },
    ],
    ["a name that is empty", { clientName: "" }, { name: "" }],
  ];
  for (const [label, over, expected] of CLEANED) {
    test(`${label}: cleaned if it needs it, and the email goes out`, async () => {
      const out = await notifyBooking(null, {
        ...fromTheForm(),
        ...over,
      } as never);
      expect(out).toEqual({ ok: true });
      expect(sent).toHaveLength(1);
      expect(clientEmail().html).toBe(received(expected));
      expect(clientEmail().html).not.toContain("<img src=x");
    });
  }

  test("a line break in the service never reaches the subject", async () => {
    await notifyBooking(null, {
      ...fromTheForm(),
      service: "Drenaje\r\nBcc: x@evil.test",
    });
    expect(clientEmail().subject).toBe(
      "Solicitud de reserva recibida — Drenaje Bcc: x@evil.test",
    );
    expect(clientEmail().html).toBe(
      received({ service: "Drenaje Bcc: x@evil.test" }),
    );
  });

  test("the address in the payload is never the recipient, so an odd one costs nobody her email", async () => {
    const out = await notifyBooking(null, {
      ...fromTheForm(),
      clientEmail: "no es un correo",
    });
    expect(out).toEqual({ ok: true });
    expect(clientEmail().to).toBe("ana@example.test");
    expect(clientEmail().html).toBe(legacyReceived("es"));
  });

  test("what the dashboard sends passes the check, untouched", () => {
    // New booking: `create-booking.ts`.
    const created = {
      bookingId: ID,
      event: "confirmed",
      clientName: "Ana García",
      clientEmail: "ana@example.test",
      clientPhone: "+34 600 000 000",
      service: "manual-therapy",
      serviceId: "manual-therapy",
      sessionType: null,
      date: "2026-08-20",
      time: "",
      duration: null,
      locale: "es",
    };
    // Edit: `save-booking.ts`, with no phone and no language, and a time the
    // database wrote.
    const edited = {
      bookingId: ID,
      event: "rescheduled",
      clientName: "Ana",
      clientEmail: "",
      service: "Drenaje linfático",
      serviceId: "lymphatic-drainage",
      sessionType: "Sesión individual",
      date: "",
      time: "10:30:00",
      duration: "60 min",
    };
    for (const input of [created, edited]) {
      expect(readBookingNotification(input)).toEqual(input as never);
    }
    // The team writes what it wants in a name; only a stranger's is cleaned.
    expect(
      readBookingNotification({
        ...created,
        clientName: "Ana <la de los  martes>",
      })?.clientName,
    ).toBe("Ana <la de los  martes>");
    // Too long is cut for the team as well, never refused.
    expect(
      readBookingNotification({ ...created, clientName: "a".repeat(500) })
        ?.clientName,
    ).toBe("a".repeat(200));
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    expect(readBookingNotification({ ...created, service: 7 })).toBeNull();
    quiet.mockRestore();
  });
});
