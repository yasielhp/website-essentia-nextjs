import { describe, expect, test } from "bun:test";
import {
  campaignSchema,
  validateCampaign,
  validateCampaignDraft,
} from "@/lib/schemas";
import {
  AUTOMATED_KINDS,
  DEFAULT_TRIGGER,
  consentPurposeOf,
  isAutomatedKind,
} from "@/types/campaign";
import {
  fieldAvailable,
  kindAllowedForChannel,
  visitFieldsExist,
} from "./whatsapp-form";

/**
 * "Aviso de cita": a WhatsApp campaign that tells a client about her own
 * booking N hours before or after it. This pins the kind itself: what it is,
 * where it can go, how its trigger is bounded.
 */

const UUID = "3b7c1f6e-0d9a-4b52-8c1e-5a2f9d4e7b10";
const audience = {
  language: "es" as const,
  newsletter: null,
  services: [],
  lastBooking: null,
  neverBooked: false,
  sendLocale: "es" as const,
  manualIds: [] as string[],
};

const appointment = (over: Record<string, unknown> = {}) => ({
  name: "Aviso 24 h antes",
  channel: "whatsapp" as const,
  kind: "appointment" as const,
  trigger: { event: "before_visit" as const, hours: 24 },
  audience,
  content: {
    en: { subject: "", preheader: "", title: "", doc: null },
    es: { subject: "", preheader: "", title: "", doc: null },
    whatsapp: { templateId: UUID, params: [] },
  },
  ...over,
});

describe("the appointment kind", () => {
  test("runs on the automation engine: it is an automated kind", () => {
    expect(AUTOMATED_KINDS).toContain("appointment");
    expect(isAutomatedKind("appointment")).toBe(true);
  });

  test("starts as a notice the day before", () => {
    expect(DEFAULT_TRIGGER.appointment).toEqual({
      event: "before_visit",
      hours: 24,
    });
  });

  test("is a WhatsApp kind only", () => {
    expect(kindAllowedForChannel("appointment", "whatsapp")).toBe(true);
    expect(kindAllowedForChannel("appointment", "email")).toBe(false);
    // The rest are unchanged.
    expect(kindAllowedForChannel("standard", "email")).toBe(true);
    expect(kindAllowedForChannel("split", "whatsapp")).toBe(false);
  });

  test("an email appointment campaign is refused, as a draft too", () => {
    for (const validate of [validateCampaign, validateCampaignDraft]) {
      const r = validate(appointment({ channel: "email" }));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.kind).toBe("kindNotAllowedForChannel");
    }
  });

  test("a valid one passes", () => {
    expect(validateCampaign(appointment()).ok).toBe(true);
    expect(
      validateCampaign(
        appointment({ trigger: { event: "after_visit", hours: 2 } }),
      ).ok,
    ).toBe(true);
  });

  test("needs its template, like any WhatsApp campaign", () => {
    const r = validateCampaign(
      appointment({
        content: {
          en: { subject: "", preheader: "", title: "", doc: null },
          es: { subject: "", preheader: "", title: "", doc: null },
          whatsapp: { templateId: null, params: [] },
        },
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors["content.whatsapp.templateId"]).toBe("templateRequired");
    }
  });
});

describe("the hours of before_visit and after_visit", () => {
  const withHours = (event: string, hours: unknown) =>
    appointment({ trigger: { event, hours } });
  const hoursError = (event: string, hours: unknown) => {
    const r = validateCampaign(withHours(event, hours));
    return r.ok ? null : (r.errors["trigger.hours"] ?? "other");
  };

  test("before_visit takes 1 to 336 hours", () => {
    expect(hoursError("before_visit", 1)).toBeNull();
    expect(hoursError("before_visit", 336)).toBeNull();
    expect(hoursError("before_visit", 0)).toBe("hoursOutOfRange");
    expect(hoursError("before_visit", 337)).toBe("hoursOutOfRange");
  });

  test("after_visit takes 1 to 720 hours", () => {
    expect(hoursError("after_visit", 1)).toBeNull();
    expect(hoursError("after_visit", 720)).toBeNull();
    expect(hoursError("after_visit", 0)).toBe("hoursOutOfRange");
    expect(hoursError("after_visit", 721)).toBe("hoursOutOfRange");
  });

  test("a notice with no hours, or fractional or negative ones, is refused", () => {
    for (const event of ["before_visit", "after_visit"]) {
      expect(hoursError(event, undefined)).toBe("hoursOutOfRange");
      expect(hoursError(event, 1.5)).toBe("hoursOutOfRange");
      expect(hoursError(event, -3)).toBe("hoursOutOfRange");
    }
  });

  test("the draft holds the same limits: it must load back into the form", () => {
    const r = validateCampaignDraft(withHours("before_visit", 400));
    expect(r.ok).toBe(false);
  });

  test("first_visit keeps its own limit of 168", () => {
    const first = (hours: number) =>
      validateCampaign({
        ...appointment(),
        kind: "automated",
        trigger: { event: "first_visit", hours },
      });
    expect(first(168).ok).toBe(true);
    expect(first(169).ok).toBe(false);
  });
});

describe("the ceiling on hours is back for every event that is not an appointment's", () => {
  const withEvent = (event: string, hours: number) =>
    validateCampaign({
      ...appointment(),
      kind: "automated",
      trigger: { event, hours },
    });

  test("168 hours, as before the appointment kind, for any other event", () => {
    for (const event of [
      "segment_entry",
      "after_booking",
      "birthday",
      "new_blog_post",
    ]) {
      expect(withEvent(event, 168).ok).toBe(true);
      const over = withEvent(event, 169);
      expect(over.ok).toBe(false);
      if (!over.ok)
        expect(over.errors["trigger.hours"]).toBe("hoursOutOfRange");
    }
  });

  test("and in a draft too", () => {
    const r = validateCampaignDraft({
      ...appointment(),
      kind: "automated",
      trigger: { event: "segment_entry", hours: 300 },
    });
    expect(r.ok).toBe(false);
  });

  test("a trigger with no event has the same ceiling", () => {
    const r = validateCampaign({
      ...appointment(),
      kind: "standard",
      trigger: { hours: 300 },
    });
    expect(r.ok).toBe(false);
  });

  test("an appointment's 721 hours is ONE error, not two", () => {
    const parsed = campaignSchema.safeParse(
      appointment({ trigger: { event: "after_visit", hours: 721 } }),
    );
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const onHours = parsed.error.issues.filter(
        (i) => i.path.join(".") === "trigger.hours",
      );
      expect(onHours).toHaveLength(1);
    }
  });

  test("and so is a before_visit of 400, and a first_visit of 300", () => {
    for (const [kind, trigger] of [
      ["appointment", { event: "before_visit", hours: 400 }],
      ["automated", { event: "first_visit", hours: 300 }],
    ] as const) {
      const parsed = campaignSchema.safeParse(appointment({ kind, trigger }));
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(
          parsed.error.issues.filter(
            (i) => i.path.join(".") === "trigger.hours",
          ),
        ).toHaveLength(1);
      }
    }
  });
});

describe("what the appointment kind may not carry", () => {
  test("hand-picked contacts are refused: the audience is the appointments", () => {
    const r = validateCampaign(
      appointment({ audience: { ...audience, manualIds: [UUID] } }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors["audience.manualIds"]).toBe("manualNotAllowed");
  });

  test("the only events it runs on are before_visit and after_visit", () => {
    for (const event of [
      "segment_entry",
      "after_booking",
      "first_visit",
      "birthday",
    ]) {
      const r = validateCampaign(
        appointment({ trigger: { event, hours: 24 } }),
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors["trigger.event"]).toBe("invalidInput");
    }
    expect(validateCampaign(appointment({ trigger: { hours: 24 } })).ok).toBe(
      false,
    );
  });

  test("and those two events belong to no other kind", () => {
    for (const event of ["before_visit", "after_visit"]) {
      const r = validateCampaign({
        ...appointment(),
        kind: "automated",
        trigger: { event, hours: 24 },
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors["trigger.event"]).toBe("invalidInput");
    }
  });

  test("hand-picked contacts stay fine for the other kinds", () => {
    const r = validateCampaign({
      ...appointment(),
      kind: "standard",
      trigger: {},
      audience: { ...audience, manualIds: [UUID] },
    });
    expect(r.ok).toBe(true);
  });
});

describe("what a message of this kind can say about the visit", () => {
  test("the visit fields exist for both events", () => {
    for (const event of ["before_visit", "after_visit"] as const) {
      expect(visitFieldsExist("appointment", { event, hours: 24 })).toBe(true);
      expect(fieldAvailable("date", "appointment", { event, hours: 24 })).toBe(
        true,
      );
      expect(fieldAvailable("time", "appointment", { event, hours: 24 })).toBe(
        true,
      );
    }
  });

  test("and still not for a kind with no visit", () => {
    expect(visitFieldsExist("standard", {})).toBe(false);
    expect(visitFieldsExist("automated", { event: "birthday" })).toBe(false);
    expect(visitFieldsExist("automated", { event: "after_booking" })).toBe(
      true,
    );
  });
});

describe("consentPurposeOf", () => {
  test("an appointment notice is transactional: the consent to appointment notices", () => {
    expect(consentPurposeOf("appointment")).toBe("appointment");
  });
  test("everything else is marketing", () => {
    for (const kind of [
      "standard",
      "automated",
      "autoresponder",
      "split",
      "rss",
      "dateBased",
    ] as const) {
      expect(consentPurposeOf(kind)).toBe("marketing");
    }
  });
});
