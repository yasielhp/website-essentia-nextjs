import { describe, expect, it } from "bun:test";
import { dueRecipients, localDay } from "./automation-rules";
import type { Appointment, Recipient } from "./audience-filter";

const NOW = new Date("2026-09-05T12:00:00Z"); // 2026-09-05 in the Canaries
const ACTIVATED = "2026-09-01T00:00:00Z";

const r = (over: Partial<Recipient> = {}): Recipient => ({
  id: "1",
  email: "a@x.com",
  firstName: "A",
  language: "es",
  lastBookingDate: null,
  firstBookingDate: null,
  subscribedAt: null,
  birthdate: null,
  ...over,
});

const cycles = (due: ReturnType<typeof dueRecipients>) =>
  due.map((d) => `${d.recipient.id}:${d.cycle}`);

describe("localDay", () => {
  it("formats the Canary day as YYYY-MM-DD", () => {
    expect(localDay(NOW)).toBe("2026-09-05");
    // Just before midnight UTC is still the same day in the Canaries (UTC+1).
    expect(localDay(new Date("2026-09-05T23:30:00Z"))).toBe("2026-09-06");
  });
});

describe("dueRecipients", () => {
  it("segment_entry owes everyone once", () => {
    const due = dueRecipients({
      trigger: { event: "segment_entry" },
      recipients: [r(), r({ id: "2", email: "b@x.com" })],
      activatedAt: ACTIVATED,
      now: NOW,
    });
    expect(cycles(due)).toEqual(["1:", "2:"]);
  });

  it("newsletter_subscribed greets only those who joined after activation", () => {
    const due = dueRecipients({
      trigger: { event: "newsletter_subscribed" },
      recipients: [
        r({ subscribedAt: "2026-09-03T10:00:00Z" }),
        r({ id: "2", subscribedAt: "2026-08-20T10:00:00Z" }),
        r({ id: "3", subscribedAt: null }),
      ],
      activatedAt: ACTIVATED,
      now: NOW,
    });
    expect(cycles(due)).toEqual(["1:"]);
  });

  describe("newsletter_subscribed on WhatsApp", () => {
    // `filterAudience` hands a WhatsApp recipient the date of its consent as
    // `subscribedAt` and `subscriptionCycle`; the rule never learns the channel.
    const consent = (at: string, over: Partial<Recipient> = {}) =>
      r({
        id: "w",
        email: null,
        phone: "+34600112233",
        subscribedAt: at,
        subscriptionCycle: at,
        ...over,
      });
    const run = (recipient: Recipient) =>
      dueRecipients({
        trigger: { event: "newsletter_subscribed" },
        recipients: [recipient],
        activatedAt: ACTIVATED,
        now: NOW,
      });

    it("does not greet a consent given before activation", () => {
      expect(run(consent("2026-08-30T10:00:00.000Z"))).toEqual([]);
    });

    it("greets a consent given after activation, under that consent's own cycle", () => {
      expect(cycles(run(consent("2026-09-03T10:00:00.000Z")))).toEqual([
        "w:2026-09-03T10:00:00.000Z",
      ]);
    });

    it("greets again after a STOP and a new consent: the cycle is new", () => {
      const first = run(consent("2026-09-02T10:00:00.000Z"));
      const again = run(consent("2026-09-04T08:00:00.000Z"));
      expect(first[0].cycle).not.toBe(again[0].cycle);
    });

    it("a consent that did not change gives the same cycle on every run", () => {
      const at = "2026-09-03T10:00:00.000Z";
      expect(run(consent(at))[0].cycle).toBe(run(consent(at))[0].cycle);
    });
  });

  it("newsletter_subscribed on email still greets once in a lifetime", () => {
    const due = dueRecipients({
      trigger: { event: "newsletter_subscribed" },
      recipients: [r({ subscribedAt: "2026-09-03T10:00:00Z" })],
      activatedAt: ACTIVATED,
      now: NOW,
    });
    expect(cycles(due)).toEqual(["1:"]);
  });

  describe("newsletter_subscribed compares instants, not text", () => {
    const owed = (subscribedAt: string, activatedAt: string) =>
      dueRecipients({
        trigger: { event: "newsletter_subscribed" },
        recipients: [r({ subscribedAt })],
        activatedAt,
        now: NOW,
      }).length;

    it("Z and +00:00 spell the same moment: equal counts as joined", () => {
      expect(
        owed("2026-09-01T00:00:00+00:00", "2026-09-01T00:00:00.000Z"),
      ).toBe(1);
      expect(
        owed("2026-09-01T00:00:00.000Z", "2026-09-01T00:00:00+00:00"),
      ).toBe(1);
    });

    it("a fraction of a second does not decide it", () => {
      expect(owed("2026-09-01T00:00:00.500Z", "2026-09-01T00:00:00Z")).toBe(1);
      expect(owed("2026-08-31T23:59:59.999Z", "2026-09-01T00:00:00Z")).toBe(0);
    });

    it("another offset is another moment", () => {
      // 01:00 at +02:00 is 23:00 the evening before, in UTC.
      expect(owed("2026-09-01T01:00:00+02:00", "2026-09-01T00:00:00Z")).toBe(0);
      expect(owed("2026-09-01T03:00:00+02:00", "2026-09-01T00:00:00Z")).toBe(1);
    });

    it("text that is not a date greets nobody", () => {
      expect(owed("not a date", "2026-09-01T00:00:00Z")).toBe(0);
    });

    it("agrees with the old text comparison wherever the instants clearly differ", () => {
      const activated = "2026-09-01T00:00:00.000Z";
      const formats = (iso: string) => [
        iso,
        iso.replace(".000Z", "Z"),
        iso.replace(".000Z", "+00:00"),
        iso.replace(".000Z", ".000+00:00"),
      ];
      for (let hours = -48; hours <= 48; hours += 1) {
        const at = new Date(Date.parse(activated) + hours * 3_600_000 + 30_000);
        const iso = at.toISOString();
        for (const text of formats(iso)) {
          const before = text >= activated ? 1 : 0;
          expect([text, owed(text, activated)]).toEqual([text, before]);
        }
      }
    });
  });

  it("after_booking fires N days after the last booking, keyed by that date", () => {
    const due = dueRecipients({
      trigger: { event: "after_booking", days: 3 },
      recipients: [
        r({ lastBookingDate: "2026-09-02" }),
        r({ id: "2", lastBookingDate: "2026-09-01" }),
      ],
      activatedAt: ACTIVATED,
      now: NOW,
    });
    expect(cycles(due)).toEqual(["1:2026-09-02"]);
  });

  it("birthday matches month and day, once per year", () => {
    const due = dueRecipients({
      trigger: { event: "birthday" },
      recipients: [
        r({ birthdate: "1990-09-05" }),
        r({ id: "2", birthdate: "1990-09-06" }),
      ],
      activatedAt: ACTIVATED,
      now: NOW,
    });
    expect(cycles(due)).toEqual(["1:2026"]);
  });

  it("first_booking_anniversary skips the year of the booking itself", () => {
    const due = dueRecipients({
      trigger: { event: "first_booking_anniversary" },
      recipients: [
        r({ firstBookingDate: "2025-09-05" }),
        r({ id: "2", firstBookingDate: "2026-09-05" }),
      ],
      activatedAt: ACTIVATED,
      now: NOW,
    });
    expect(cycles(due)).toEqual(["1:2026"]);
  });

  it("new_blog_post sends each post published since activation, with its vars", () => {
    const due = dueRecipients({
      trigger: { event: "new_blog_post" },
      recipients: [r({ language: "es" }), r({ id: "2", language: "en" })],
      activatedAt: ACTIVATED,
      now: NOW,
      posts: [
        {
          id: "p1",
          publishedAt: "2026-09-04T09:00:00Z",
          title: { en: "Autumn", es: "Otoño" },
          excerpt: { en: "e", es: "x" },
          url: { en: "https://a/blog/autumn", es: "https://a/es/blog/otono" },
        },
        {
          id: "p0",
          publishedAt: "2026-08-01T09:00:00Z",
          title: { en: "Old", es: "Viejo" },
          excerpt: { en: "", es: "" },
          url: { en: "https://a/blog/old", es: "https://a/es/blog/viejo" },
        },
      ],
    });
    expect(cycles(due)).toEqual(["1:p1", "2:p1"]);
    expect(due[0]?.vars?.post_title).toBe("Otoño");
    expect(due[1]?.vars?.post_url).toBe("https://a/blog/autumn");
  });

  it("an unknown or missing event owes nobody", () => {
    expect(
      dueRecipients({
        trigger: {},
        recipients: [r()],
        activatedAt: ACTIVATED,
        now: NOW,
      }),
    ).toEqual([]);
  });
});

describe("first_visit", () => {
  const now = new Date("2026-12-10T17:30:00Z");
  const activatedAt = "2026-12-01T00:00:00Z";
  const visitor = (over: Partial<Recipient> = {}): Recipient =>
    r({
      id: "c1",
      confirmedBookingsCount: 1,
      firstVisitEndsAt: "2026-12-10T14:00:00Z",
      ...over,
    });

  it("fires once the first visit ended at least `hours` ago", () => {
    const due = dueRecipients({
      trigger: { event: "first_visit", hours: 3 },
      recipients: [visitor()],
      activatedAt,
      now,
    });
    expect(cycles(due)).toEqual(["c1:"]);
  });

  it("fires exactly when the delay elapses", () => {
    const due = dueRecipients({
      trigger: { event: "first_visit", hours: 3 },
      recipients: [visitor({ firstVisitEndsAt: "2026-12-10T14:30:00Z" })],
      activatedAt,
      now,
    });
    expect(cycles(due)).toEqual(["c1:"]);
  });

  it("waits while the delay has not elapsed", () => {
    expect(
      dueRecipients({
        trigger: { event: "first_visit", hours: 4 },
        recipients: [visitor()],
        activatedAt,
        now,
      }),
    ).toEqual([]);
  });

  it("treats a missing delay as zero hours", () => {
    const due = dueRecipients({
      trigger: { event: "first_visit" },
      recipients: [visitor()],
      activatedAt,
      now,
    });
    expect(cycles(due)).toEqual(["c1:"]);
  });

  it("ignores clients whose first visit predates the campaign", () => {
    expect(
      dueRecipients({
        trigger: { event: "first_visit", hours: 0 },
        recipients: [visitor({ firstVisitEndsAt: "2026-11-20T10:00:00Z" })],
        activatedAt,
        now,
      }),
    ).toEqual([]);
  });

  it("ignores contacts with no confirmed visit", () => {
    expect(
      dueRecipients({
        trigger: { event: "first_visit", hours: 0 },
        recipients: [
          visitor({ firstVisitEndsAt: null, confirmedBookingsCount: 0 }),
        ],
        activatedAt,
        now,
      }),
    ).toEqual([]);
  });

  describe("limited to a session type", () => {
    const DRAINAGE = "59d57d59-7b9b-4e32-83fe-c144ec7e8a24";
    const MASSAGE = "11111111-1111-4111-8111-111111111111";
    const trigger = {
      event: "first_visit" as const,
      hours: 3,
      tierId: DRAINAGE,
    };

    it("ignores a first visit of another type", () => {
      expect(
        dueRecipients({
          trigger,
          recipients: [
            visitor({
              firstVisitEndsAt: "2026-12-10T14:00:00Z",
              firstVisitEndsAtByTier: { [MASSAGE]: "2026-12-10T14:00:00Z" },
            }),
          ],
          activatedAt,
          now,
        }),
      ).toEqual([]);
    });

    it("fires for the drainage even when a massage came first", () => {
      const due = dueRecipients({
        trigger,
        recipients: [
          visitor({
            // The massage was the first visit of any kind, back in November.
            firstVisitEndsAt: "2026-11-20T10:00:00Z",
            firstVisitEndsAtByTier: {
              [MASSAGE]: "2026-11-20T10:00:00Z",
              [DRAINAGE]: "2026-12-10T14:00:00Z",
            },
          }),
        ],
        activatedAt,
        now,
      });
      expect(cycles(due)).toEqual(["c1:"]);
    });

    it("still respects the delay and the activation date for that type", () => {
      expect(
        dueRecipients({
          trigger: { ...trigger, hours: 4 },
          recipients: [
            visitor({
              firstVisitEndsAtByTier: { [DRAINAGE]: "2026-12-10T14:00:00Z" },
            }),
          ],
          activatedAt,
          now,
        }),
      ).toEqual([]);
      expect(
        dueRecipients({
          trigger,
          recipients: [
            visitor({
              firstVisitEndsAtByTier: { [DRAINAGE]: "2026-11-20T10:00:00Z" },
            }),
          ],
          activatedAt,
          now,
        }),
      ).toEqual([]);
    });

    it("without a tierId keeps looking at the first visit of any type", () => {
      const due = dueRecipients({
        trigger: { event: "first_visit", hours: 3 },
        recipients: [
          visitor({
            firstVisitEndsAt: "2026-12-10T14:00:00Z",
            firstVisitEndsAtByTier: { [MASSAGE]: "2026-12-10T14:00:00Z" },
          }),
        ],
        activatedAt,
        now,
      });
      expect(cycles(due)).toEqual(["c1:"]);
    });
  });
});

describe("visit variables for the message", () => {
  const visit = {
    service: "Drenaje linfático",
    sessionType: "Sesión larga",
    date: "2026-12-10",
    time: "09:30",
  };
  const NOW_AFTER = new Date("2026-12-13T12:00:00Z");
  const ACTIVE = "2026-12-01T00:00:00Z";

  const afterBooking = (recipient: Recipient) =>
    dueRecipients({
      trigger: { event: "after_booking", days: 3 },
      recipients: [recipient],
      activatedAt: ACTIVE,
      now: NOW_AFTER,
    });

  const firstVisit = (recipient: Recipient, tierId?: string) =>
    dueRecipients({
      trigger: { event: "first_visit", hours: 0, tierId },
      recipients: [recipient],
      activatedAt: ACTIVE,
      now: NOW_AFTER,
    });

  const visitor = (over: Partial<Recipient> = {}): Recipient =>
    r({
      id: "v",
      lastBookingDate: "2026-12-10",
      confirmedBookingsCount: 1,
      firstVisitEndsAt: "2026-12-10T11:00:00Z",
      lastVisit: visit,
      firstVisit: visit,
      ...over,
    });

  it("after_booking carries the last visit, the date in Spanish", () => {
    const [due] = afterBooking(visitor({ language: "es" }));
    expect(due.vars).toEqual({
      service: "Drenaje linfático",
      session_type: "Sesión larga",
      date: "jueves, 10 de diciembre de 2026",
      time: "09:30",
    });
  });

  it("after_booking carries it in English with the English date", () => {
    const [due] = afterBooking(visitor({ language: "en" }));
    expect(due.vars?.date).toBe("Thursday, 10 December 2026");
    expect(due.vars?.service).toBe("Drenaje linfático");
    expect(due.vars?.time).toBe("09:30");
  });

  it("first_visit carries the first visit, in the recipient's language", () => {
    const es = firstVisit(visitor({ language: "es" }))[0];
    const en = firstVisit(visitor({ language: "en" }))[0];
    expect(es.vars).toEqual({
      service: "Drenaje linfático",
      session_type: "Sesión larga",
      date: "jueves, 10 de diciembre de 2026",
      time: "09:30",
    });
    expect(en.vars?.date).toBe("Thursday, 10 December 2026");
  });

  it("first_visit with a tierId carries the first visit of that type", () => {
    const other = { ...visit, service: "Masaje", sessionType: "Corta" };
    const [due] = firstVisit(
      visitor({
        firstVisit: other,
        firstVisitByTier: { t1: visit },
        firstVisitEndsAtByTier: { t1: "2026-12-10T11:00:00Z" },
      }),
      "t1",
    );
    expect(due.vars?.service).toBe("Drenaje linfático");
    expect(due.vars?.session_type).toBe("Sesión larga");
  });

  it("first_visit without a tierId ignores the per-type visits", () => {
    const other = { ...visit, service: "Masaje" };
    const [due] = firstVisit(
      visitor({ firstVisit: other, firstVisitByTier: { t1: visit } }),
    );
    expect(due.vars?.service).toBe("Masaje");
  });

  it("brings no such keys when the contact has no visit data", () => {
    const [a] = afterBooking(visitor({ lastVisit: undefined }));
    const [f] = firstVisit(visitor({ firstVisit: undefined }));
    expect(a.vars).toBeUndefined();
    expect(f.vars).toBeUndefined();
  });

  it("leaves out the service when the booking has none", () => {
    const [due] = afterBooking(
      visitor({ lastVisit: { ...visit, service: "", sessionType: null } }),
    );
    expect(due.vars).not.toHaveProperty("service");
    expect(due.vars).not.toHaveProperty("session_type");
    expect(due.vars?.time).toBe("09:30");
  });

  it("leaves out a time the booking does not carry", () => {
    const [due] = afterBooking(visitor({ lastVisit: { ...visit, time: "" } }));
    expect(due.vars).not.toHaveProperty("time");
  });

  it("keeps the campaign's own cycle", () => {
    expect(cycles(afterBooking(visitor()))).toEqual(["v:2026-12-10"]);
    expect(cycles(firstVisit(visitor()))).toEqual(["v:"]);
  });

  it("leaves out a date that cannot be formatted", () => {
    const [due] = afterBooking(
      visitor({ lastVisit: { ...visit, date: "2026-xx-10" } }),
    );
    expect(due.vars).not.toHaveProperty("date");
    expect(due.vars?.service).toBe("Drenaje linfático");
  });

  it("first_visit with a tierId is due without vars when the type has no visit data", () => {
    const [due] = firstVisit(
      visitor({
        firstVisitEndsAtByTier: { t1: "2026-12-10T11:00:00Z" },
        firstVisitByTier: {},
      }),
      "t1",
    );
    expect(due.recipient.id).toBe("v");
    expect(due.vars).toBeUndefined();
  });
});

describe("appointment notices", () => {
  const ACTIVATED_AT = "2026-12-01T00:00:00Z";
  const WINTER = "2026-12-11"; // UTC+0: 09:00 here is 09:00Z.
  const SUMMER = "2026-07-11"; // UTC+1: 09:00 here is 08:00Z.

  const appt = (id: string, over: Partial<Appointment> = {}): Appointment => ({
    id,
    serviceId: "svc-1",
    status: "confirmed",
    startsAt: `${WINTER}T09:00:00.000Z`,
    endsAt: `${WINTER}T10:00:00.000Z`,
    visit: {
      service: "Drenaje linfático",
      sessionType: "Sesión individual",
      date: WINTER,
      time: "09:00",
    },
    ...over,
  });

  const person = (appointments: Appointment[], over: Partial<Recipient> = {}) =>
    r({ id: "p1", language: "es", appointments, ...over });

  const run = (
    event: "before_visit" | "after_visit",
    hours: number | undefined,
    recipients: Recipient[],
    at: string,
    extra: { activatedAt?: string; services?: string[] } = {},
  ) =>
    dueRecipients({
      trigger: { event, hours },
      recipients,
      activatedAt: extra.activatedAt ?? ACTIVATED_AT,
      now: new Date(at),
      services: extra.services,
    });

  const ids = (due: ReturnType<typeof dueRecipients>) =>
    due.map((d) => `${d.recipient.id}:${d.cycle}`);

  describe("before_visit", () => {
    const bookings = [person([appt("b1")])];

    it("is due from N hours before the start until the start", () => {
      expect(
        ids(run("before_visit", 24, bookings, "2026-12-10T09:00:00Z")),
      ).toEqual(["p1:b1"]);
      expect(
        ids(run("before_visit", 24, bookings, "2026-12-10T20:00:00Z")),
      ).toEqual(["p1:b1"]);
      expect(
        ids(run("before_visit", 24, bookings, "2026-12-11T08:59:59Z")),
      ).toEqual(["p1:b1"]);
    });

    it("is not due before that moment", () => {
      expect(run("before_visit", 24, bookings, "2026-12-10T08:59:59Z")).toEqual(
        [],
      );
    });

    it("is not due once the visit has started: a reminder after the fact is no reminder", () => {
      expect(run("before_visit", 24, bookings, "2026-12-11T09:00:00Z")).toEqual(
        [],
      );
      expect(run("before_visit", 24, bookings, "2026-12-11T12:00:00Z")).toEqual(
        [],
      );
    });

    it("does not reach back before the campaign was switched on", () => {
      // The moment to tell her (Dec 10, 09:00) passed before activation.
      expect(
        run("before_visit", 24, bookings, "2026-12-10T12:00:00Z", {
          activatedAt: "2026-12-10T10:00:00Z",
        }),
      ).toEqual([]);
    });

    it("but a moment that falls exactly on the activation counts", () => {
      expect(
        ids(
          run("before_visit", 24, bookings, "2026-12-10T12:00:00Z", {
            activatedAt: "2026-12-10T09:00:00Z",
          }),
        ),
      ).toEqual(["p1:b1"]);
    });

    it("switching it on does not fire a burst for the bookings already inside the window", () => {
      const soon = [
        person([appt("soon", { startsAt: "2026-12-10T15:00:00.000Z" })]),
      ];
      // 24 h before 15:00 was yesterday 15:00; activation is today at noon.
      expect(
        run("before_visit", 24, soon, "2026-12-10T12:00:00Z", {
          activatedAt: "2026-12-10T12:00:00Z",
        }),
      ).toEqual([]);
    });

    it("every confirmed booking of the client counts, not only the next one", () => {
      const many = [
        person([
          appt("b1"),
          appt("b2", {
            startsAt: "2026-12-11T10:00:00.000Z",
            visit: {
              service: "Masaje",
              sessionType: null,
              date: WINTER,
              time: "10:00",
            },
          }),
          appt("b3", { startsAt: "2026-12-20T09:00:00.000Z" }),
        ]),
      ];
      expect(
        ids(run("before_visit", 24, many, "2026-12-10T12:00:00Z")),
      ).toEqual(["p1:b1", "p1:b2"]);
    });

    it("a cancelled, pending or completed booking never gets a notice before it", () => {
      const out = run(
        "before_visit",
        24,
        [
          person([
            appt("x1", { status: "cancelled" as never }),
            appt("x2", { status: "pending" as never }),
            appt("x3", { status: "completed" }),
          ]),
        ],
        "2026-12-10T12:00:00Z",
      );
      expect(out).toEqual([]);
    });

    it("the cycle is the booking: one notice per booking, the same every time it is asked", () => {
      const first = run("before_visit", 24, bookings, "2026-12-10T12:00:00Z");
      const again = run("before_visit", 24, bookings, "2026-12-10T12:15:00Z");
      expect(ids(first)).toEqual(ids(again));
      expect(first[0]?.cycle).toBe("b1");
    });

    it("two bookings of one client are two cycles", () => {
      const two = [person([appt("b1"), appt("b2")])];
      const cycles = run("before_visit", 24, two, "2026-12-10T12:00:00Z").map(
        (d) => d.cycle,
      );
      expect(cycles).toEqual(["b1", "b2"]);
    });

    it("hours are real hours across the clock change, not wall-clock hours", () => {
      // The Canaries put their clocks back on 2026-10-25 (01:00Z). A visit on
      // the 26th at 09:00 (UTC+0) with a notice 48 hours before is due at
      // 09:00Z on the 24th, which on the wall clock of the 24th (UTC+1) reads
      // 10:00: counting wall-clock hours would be an hour out.
      const afterChange = [
        person([appt("c1", { startsAt: "2026-10-26T09:00:00.000Z" })]),
      ];
      const early = { activatedAt: "2026-10-01T00:00:00Z" };
      expect(
        run("before_visit", 48, afterChange, "2026-10-24T08:59:00Z", early),
      ).toEqual([]);
      expect(
        ids(
          run("before_visit", 48, afterChange, "2026-10-24T09:00:00Z", early),
        ),
      ).toEqual(["p1:c1"]);
    });

    it("hours that are not a whole number of at least one owe nothing", () => {
      for (const hours of [undefined, 0, -2, 1.5]) {
        expect(
          run("before_visit", hours, bookings, "2026-12-10T12:00:00Z"),
        ).toEqual([]);
      }
    });

    it("a client with no appointments is owed nothing", () => {
      expect(
        run("before_visit", 24, [r({ id: "p1" })], "2026-12-10T12:00:00Z"),
      ).toEqual([]);
    });
  });

  describe("after_visit", () => {
    const bookings = [person([appt("b1")])];

    it("is due from N hours after the end", () => {
      expect(run("after_visit", 2, bookings, "2026-12-11T11:59:59Z")).toEqual(
        [],
      );
      expect(
        ids(run("after_visit", 2, bookings, "2026-12-11T12:00:00Z")),
      ).toEqual(["p1:b1"]);
      expect(
        ids(run("after_visit", 2, bookings, "2026-12-11T15:00:00Z")),
      ).toEqual(["p1:b1"]);
    });

    it("does not reach back before the campaign was switched on", () => {
      expect(
        run("after_visit", 2, bookings, "2026-12-12T09:00:00Z", {
          activatedAt: "2026-12-12T00:00:00Z",
        }),
      ).toEqual([]);
      expect(
        ids(
          run("after_visit", 2, bookings, "2026-12-12T09:00:00Z", {
            activatedAt: "2026-12-11T12:00:00Z",
          }),
        ),
      ).toEqual(["p1:b1"]);
    });

    it("counts a booking that was confirmed and one that was completed", () => {
      const both = [person([appt("b1"), appt("b2", { status: "completed" })])];
      expect(ids(run("after_visit", 2, both, "2026-12-11T13:00:00Z"))).toEqual([
        "p1:b1",
        "p1:b2",
      ]);
    });

    it("never for a cancelled or pending one", () => {
      const out = run(
        "after_visit",
        2,
        [
          person([
            appt("x1", { status: "cancelled" as never }),
            appt("x2", { status: "pending" as never }),
          ]),
        ],
        "2026-12-12T09:00:00Z",
      );
      expect(out).toEqual([]);
    });

    it("a booking with no length ends when it starts", () => {
      const noLength = [
        person([appt("b1", { endsAt: `${WINTER}T09:00:00.000Z` })]),
      ];
      expect(
        ids(run("after_visit", 1, noLength, "2026-12-11T10:00:00Z")),
      ).toEqual(["p1:b1"]);
    });

    it("one notice per booking: the cycle is the booking", () => {
      const first = run("after_visit", 2, bookings, "2026-12-11T13:00:00Z");
      const later = run("after_visit", 2, bookings, "2026-12-11T13:15:00Z");
      expect(first.map((d) => d.cycle)).toEqual(["b1"]);
      expect(later.map((d) => d.cycle)).toEqual(["b1"]);
    });

    it("works the same in summer, when the clock is an hour ahead", () => {
      const summer = [
        person([
          appt("s1", {
            startsAt: `${SUMMER}T08:00:00.000Z`,
            endsAt: `${SUMMER}T09:00:00.000Z`,
          }),
        ]),
      ];
      const early = { activatedAt: "2026-07-01T00:00:00Z" };
      expect(
        run("after_visit", 2, summer, "2026-07-11T10:59:00Z", early),
      ).toEqual([]);
      expect(
        ids(run("after_visit", 2, summer, "2026-07-11T11:00:00Z", early)),
      ).toEqual(["p1:s1"]);
    });

    it("hours outside the engine's range owe nothing", () => {
      for (const hours of [undefined, 0, 2.5]) {
        expect(
          run("after_visit", hours, bookings, "2026-12-12T09:00:00Z"),
        ).toEqual([]);
      }
    });
  });

  describe("which bookings", () => {
    const mixed = [
      person([
        appt("a", { serviceId: "svc-1" }),
        appt("b", { serviceId: "svc-2" }),
        appt("c", { serviceId: null }),
      ]),
    ];

    it("with services chosen, only the bookings of those services, not the whole client", () => {
      const out = run("before_visit", 24, mixed, "2026-12-10T12:00:00Z", {
        services: ["svc-2"],
      });
      expect(out.map((d) => d.cycle)).toEqual(["b"]);
    });

    it("with none chosen, every booking", () => {
      expect(
        run("before_visit", 24, mixed, "2026-12-10T12:00:00Z", {
          services: [],
        }).map((d) => d.cycle),
      ).toEqual(["a", "b", "c"]);
    });

    it("a booking with no service is not one of the chosen services", () => {
      const out = run("before_visit", 24, mixed, "2026-12-10T12:00:00Z", {
        services: ["svc-1", "svc-2"],
      });
      expect(out.map((d) => d.cycle)).toEqual(["a", "b"]);
    });
  });

  describe("what the message says", () => {
    it("is about that booking: service, session type, date in her language, time", () => {
      const [es] = run(
        "before_visit",
        24,
        [person([appt("b1")], { language: "es" })],
        "2026-12-10T12:00:00Z",
      );
      expect(es?.vars).toEqual({
        service: "Drenaje linfático",
        session_type: "Sesión individual",
        date: "viernes, 11 de diciembre de 2026",
        time: "09:00",
      });
      const [en] = run(
        "before_visit",
        24,
        [person([appt("b1")], { language: "en" })],
        "2026-12-10T12:00:00Z",
      );
      expect(en?.vars?.date).toBe("Friday, 11 December 2026");
    });

    it("each booking brings its own", () => {
      const out = run(
        "before_visit",
        24,
        [
          person([
            appt("b1"),
            appt("b2", {
              startsAt: "2026-12-11T10:00:00.000Z",
              visit: {
                service: "Masaje",
                sessionType: null,
                date: WINTER,
                time: "10:00",
              },
            }),
          ]),
        ],
        "2026-12-10T12:00:00Z",
      );
      expect(out.map((d) => d.vars?.service)).toEqual([
        "Drenaje linfático",
        "Masaje",
      ]);
      expect(out[1]?.vars).not.toHaveProperty("session_type");
    });

    it("a booking with no time says no time, and a missing service no service", () => {
      const [out] = run(
        "before_visit",
        24,
        [
          person([
            appt("b1", {
              visit: { service: "", sessionType: null, date: WINTER, time: "" },
            }),
          ]),
        ],
        "2026-12-10T12:00:00Z",
      );
      expect(out?.vars).not.toHaveProperty("time");
      expect(out?.vars).not.toHaveProperty("service");
      expect(out?.vars?.date).toBeDefined();
    });
  });

  it("the other events are untouched by the new ones", () => {
    expect(
      dueRecipients({
        trigger: { event: "segment_entry" },
        recipients: [person([appt("b1")])],
        activatedAt: ACTIVATED_AT,
        now: new Date("2026-12-10T12:00:00Z"),
      }).map((d) => d.cycle),
    ).toEqual([""]);
  });
});
