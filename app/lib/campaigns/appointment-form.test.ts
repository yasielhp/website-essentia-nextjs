import { describe, expect, test } from "bun:test";
import {
  APPOINTMENT_HOURS,
  appointmentHoursIssue,
  appointmentGrace,
  appointmentLabel,
  appointmentSentence,
  audienceRowOf,
  appointmentShort,
  isAppointmentEvent,
  kindSwitchAllowed,
  withAppointmentEvent,
} from "./appointment-form";
import { validateCampaign } from "@/lib/schemas";
import { IntlMessageFormat } from "intl-messageformat";
import { GRACE_AFTER_MS, GRACE_BEFORE_MS } from "./automation-rules";
import es from "../../../messages/es/dashboard.json";
import en from "../../../messages/en/dashboard.json";

describe("isAppointmentEvent", () => {
  test("only the two events of an appointment notice", () => {
    expect(isAppointmentEvent("before_visit")).toBe(true);
    expect(isAppointmentEvent("after_visit")).toBe(true);
    expect(isAppointmentEvent("after_booking")).toBe(false);
    expect(isAppointmentEvent(undefined)).toBe(false);
  });
});

describe("appointmentHoursIssue", () => {
  test("before: one hour to two weeks", () => {
    expect(appointmentHoursIssue("before_visit", 1)).toBeNull();
    expect(appointmentHoursIssue("before_visit", 336)).toBeNull();
    expect(appointmentHoursIssue("before_visit", 0)).toBe("hoursOutOfRange");
    expect(appointmentHoursIssue("before_visit", 337)).toBe("hoursOutOfRange");
  });
  test("after: one hour to thirty days", () => {
    expect(appointmentHoursIssue("after_visit", 720)).toBeNull();
    expect(appointmentHoursIssue("after_visit", 721)).toBe("hoursOutOfRange");
  });
  test("a number that is not a whole hour, or not a number, is out of range", () => {
    expect(appointmentHoursIssue("before_visit", 1.5)).toBe("hoursOutOfRange");
    expect(appointmentHoursIssue("before_visit", Number.NaN)).toBe(
      "hoursOutOfRange",
    );
    expect(appointmentHoursIssue("before_visit", undefined)).toBe(
      "hoursOutOfRange",
    );
  });
  test("every shortcut is itself inside the limits", () => {
    for (const event of ["before_visit", "after_visit"] as const) {
      for (const hours of APPOINTMENT_HOURS[event].shortcuts) {
        expect(appointmentHoursIssue(event, hours)).toBeNull();
      }
    }
  });
});

describe("the limits are the server's", () => {
  const campaign = (event: "before_visit" | "after_visit", hours: number) => ({
    name: "x",
    channel: "whatsapp",
    kind: "appointment",
    trigger: { event, hours },
    audience: {
      language: "any",
      newsletter: null,
      services: [],
      lastBooking: null,
      neverBooked: false,
      manualIds: [],
    },
    content: {
      en: { subject: "", preheader: "", title: "", doc: null },
      es: { subject: "", preheader: "", title: "", doc: null },
      // A notice for every client has a template in each language.
      whatsapp: {
        es: { templateId: "6f1c2a3e-1111-4222-8333-444455556666", params: [] },
        en: { templateId: "7a2d3b4f-2222-4333-8444-555566667777", params: [] },
      },
    },
  });
  test("the schema accepts exactly what the form does, on both sides of each limit", () => {
    for (const event of ["before_visit", "after_visit"] as const) {
      const { min, max } = APPOINTMENT_HOURS[event];
      for (const hours of [min - 1, min, max, max + 1]) {
        expect([
          event,
          hours,
          validateCampaign(campaign(event, hours)).ok,
        ]).toEqual([
          event,
          hours,
          appointmentHoursIssue(event, hours) === null,
        ]);
      }
    }
  });
});

describe("withAppointmentEvent", () => {
  test("keeps the hours when they still fit the other side", () => {
    expect(
      withAppointmentEvent({ event: "before_visit", hours: 48 }, "after_visit"),
    ).toEqual({
      event: "after_visit",
      hours: 48,
    });
  });
  test("drops hours the other side does not allow, for its own default", () => {
    expect(
      withAppointmentEvent(
        { event: "after_visit", hours: 500 },
        "before_visit",
      ),
    ).toEqual({
      event: "before_visit",
      hours: 24,
    });
  });
  test("from nothing it starts at a day", () => {
    expect(withAppointmentEvent({}, "after_visit")).toEqual({
      event: "after_visit",
      hours: 24,
    });
  });
  test("keeps nothing else of another kind's trigger", () => {
    const out = withAppointmentEvent(
      { event: "after_booking", days: 3, tierId: "t" },
      "before_visit",
    );
    expect(out).toEqual({ event: "before_visit", hours: 24 });
  });
});

describe("appointmentSentence and appointmentShort", () => {
  test("before and after read differently", () => {
    expect(appointmentSentence({ event: "before_visit", hours: 48 })).toEqual({
      key: "sentenceBefore",
      hours: 48,
    });
    expect(appointmentSentence({ event: "after_visit", hours: 2 })).toEqual({
      key: "sentenceAfter",
      hours: 2,
    });
    expect(appointmentShort({ event: "before_visit", hours: 48 })).toEqual({
      key: "shortBefore",
      hours: 48,
    });
    expect(appointmentShort({ event: "after_visit", hours: 2 })).toEqual({
      key: "shortAfter",
      hours: 2,
    });
  });
  test("an hour count that is not valid says nothing, so the phrase cannot lie", () => {
    expect(appointmentSentence({ event: "before_visit", hours: 0 })).toBeNull();
    expect(
      appointmentSentence({ event: "before_visit", hours: 999 }),
    ).toBeNull();
    expect(appointmentShort({ event: "after_visit" })).toBeNull();
  });
  test("another event says nothing", () => {
    expect(appointmentSentence({ event: "first_visit", hours: 2 })).toBeNull();
    expect(appointmentShort({})).toBeNull();
  });
});

describe("appointmentLabel", () => {
  test("names the appointment: service, then date and time", () => {
    expect(
      appointmentLabel({
        service: "Drenaje linfático",
        date: "jueves, 20 de agosto de 2026",
        time: "10:30",
      }),
    ).toBe("Drenaje linfático · jueves, 20 de agosto de 2026 10:30");
  });
  test("what is missing is left out", () => {
    expect(appointmentLabel({ date: "20 de agosto de 2026" })).toBe(
      "20 de agosto de 2026",
    );
    expect(appointmentLabel({ service: "Masaje", time: "10:30" })).toBe(
      "Masaje · 10:30",
    );
  });
  test("with nothing to say, nothing", () => {
    expect(appointmentLabel(null)).toBeNull();
    expect(appointmentLabel(undefined)).toBeNull();
    expect(appointmentLabel({})).toBeNull();
    expect(appointmentLabel({ post_title: "x" })).toBeNull();
  });
  test("a value that is not text is not shown", () => {
    expect(
      appointmentLabel({ service: 5, date: null, time: { a: 1 } } as never),
    ).toBeNull();
  });
  test("a value that is only spaces is not shown", () => {
    expect(appointmentLabel({ service: "  ", date: "20 ago" })).toBe("20 ago");
  });
});

describe("kindSwitchAllowed", () => {
  test("a new campaign is free to be anything", () => {
    expect(kindSwitchAllowed(null, "appointment")).toBe(true);
    expect(kindSwitchAllowed(null, "standard")).toBe(true);
  });
  test("a saved campaign may change between the ordinary kinds, as it always could", () => {
    expect(kindSwitchAllowed("standard", "automated")).toBe(true);
    expect(kindSwitchAllowed("split", "rss")).toBe(true);
  });
  test("but not into an appointment notice, nor out of one: it counts a different thing", () => {
    expect(kindSwitchAllowed("standard", "appointment")).toBe(false);
    expect(kindSwitchAllowed("appointment", "standard")).toBe(false);
    expect(kindSwitchAllowed("appointment", "automated")).toBe(false);
  });
  test("staying what it is is always allowed", () => {
    expect(kindSwitchAllowed("appointment", "appointment")).toBe(true);
  });
});

describe("audienceRowOf", () => {
  test("a list campaign is described by its segment, as ever", () => {
    expect(
      audienceRowOf({
        kind: "automated",
        segmentName: "Antiguas",
        services: ["Yoga"],
        count: 4,
      }),
    ).toEqual({
      label: "audience",
      value: { kind: "segment", name: "Antiguas", count: 4 },
    });
    expect(
      audienceRowOf({
        kind: "standard",
        segmentName: null,
        services: [],
        count: null,
      }),
    ).toEqual({
      label: "audience",
      value: { kind: "segment", name: null, count: null },
    });
  });
  test("an appointment notice has no segment: services and consent, whatever segment was left over", () => {
    expect(
      audienceRowOf({
        kind: "appointment",
        segmentName: "Antiguas",
        services: ["Yoga", "Masaje"],
        count: 3,
      }),
    ).toEqual({
      label: "appointmentAudience",
      value: { kind: "appointment", services: ["Yoga", "Masaje"], count: 3 },
    });
    expect(
      audienceRowOf({
        kind: "appointment",
        segmentName: null,
        services: [],
        count: null,
      }),
    ).toEqual({
      label: "appointmentAudience",
      value: { kind: "appointment", services: [], count: null },
    });
  });
});

describe("appointmentGrace: the warning says what the engine does", () => {
  test("is the engine's own bounds", () => {
    const grace = appointmentGrace();
    expect(grace.minutes * 60_000).toBe(GRACE_BEFORE_MS);
    expect(grace.hours * 3_600_000).toBe(GRACE_AFTER_MS);
  });
  test("both languages name those very numbers", () => {
    const { minutes, hours } = appointmentGrace();
    for (const [locale, messages] of [
      ["es", es],
      ["en", en],
    ] as const) {
      const text = new IntlMessageFormat(
        messages.campaigns.trigger.appointment.grace,
        locale,
      ).format({ minutes, hours }) as string;
      expect(text).toContain(String(minutes));
      expect(text).toMatch(new RegExp(`\\b${hours} (horas|hours)`));
      // The three things it promises about: late bookings, a missed notice, a reschedule.
      expect(text.length).toBeGreaterThan(150);
    }
  });
});
