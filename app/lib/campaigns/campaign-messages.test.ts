import { describe, expect, test } from "bun:test";
import { IntlMessageFormat } from "intl-messageformat";
import { formatsCleanly } from "@/lib/icu-sample";
import es from "../../../messages/es/dashboard.json";
import en from "../../../messages/en/dashboard.json";
import { REPORT_NOTE_KEYS } from "./report";
import { CAMPAIGN_TEMPLATE_CHOICE_ISSUES } from "./whatsapp-eligibility";
import { PARAM_FIELDS } from "./whatsapp-form";

type Tree = { [key: string]: string | Tree };

function leaves(tree: Tree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out[path] = value;
    else Object.assign(out, leaves(value, path));
  }
  return out;
}

const locales = {
  es: leaves(es as unknown as Tree),
  en: leaves(en as unknown as Tree),
};

/** The groups the campaign form reads from. */
const GROUPS = ["campaigns.", "toasts.", "validation."];
const inGroups = (messages: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(messages).filter(([key]) =>
      GROUPS.some((group) => key.startsWith(group)),
    ),
  );

describe("the campaign form strings", () => {
  test("Spanish and English carry the same keys", () => {
    expect(Object.keys(inGroups(locales.en)).sort()).toEqual(
      Object.keys(inGroups(locales.es)).sort(),
    );
  });

  test("every string is valid ICU and formats with the values it asks for", () => {
    const broken: string[] = [];
    for (const locale of ["es", "en"] as const) {
      for (const [key, value] of Object.entries(inGroups(locales[locale]))) {
        if (!formatsCleanly(value, locale)) broken.push(`${locale}:${key}`);
      }
    }
    expect(broken).toEqual([]);
  });

  test("a parameter label shows its braces literally", () => {
    const label = new IntlMessageFormat(
      locales.es["campaigns.form.whatsapp.param"],
      "es",
    ).format({ n: 2 });
    expect(label).toBe("Dato {{2}}");
  });

  test("every reason a template is left out has a line and a word", () => {
    for (const messages of [locales.es, locales.en]) {
      for (const issue of CAMPAIGN_TEMPLATE_CHOICE_ISSUES) {
        expect(
          messages[`campaigns.form.whatsapp.excluded.${issue}`],
        ).toBeTruthy();
        expect(messages[`campaigns.form.whatsapp.issue.${issue}`]).toBeTruthy();
      }
    }
  });

  test("every field the form offers has a name", () => {
    for (const messages of [locales.es, locales.en]) {
      for (const field of PARAM_FIELDS) {
        expect(
          messages[`campaigns.form.whatsapp.fields.${field}`],
        ).toBeTruthy();
      }
    }
  });

  test("the WhatsApp sign-up trigger has its label, description and help", () => {
    for (const messages of [locales.es, locales.en]) {
      for (const key of [
        "campaigns.trigger.event.newsletter_subscribedWhatsApp",
        "campaigns.trigger.eventDesc.newsletter_subscribedWhatsApp",
        "campaigns.review.whatsappConsentNote",
        "campaigns.type.autoresponderDescWhatsApp",
      ]) {
        expect(messages[key]).toBeTruthy();
      }
    }
  });

  test("every note the report can show exists in both files and formats with its values", () => {
    for (const locale of ["es", "en"] as const) {
      for (const key of REPORT_NOTE_KEYS) {
        const text = locales[locale][`campaigns.detail.notes.${key}`];
        expect([locale, key, Boolean(text)]).toEqual([locale, key, true]);
        expect(formatsCleanly(text, locale)).toBe(true);
      }
    }
    expect(locales.es["campaigns.detail.notes.haltedReason"]).toContain(
      "{reason}",
    );
    expect(locales.en["campaigns.detail.notes.haltedReason"]).toContain(
      "{reason}",
    );
    for (const messages of [locales.es, locales.en]) {
      for (const key of REPORT_NOTE_KEYS) {
        expect(messages[`campaigns.detail.notes.${key}`]).toBeTruthy();
      }
      for (const key of [
        "campaigns.channel.email",
        "campaigns.channel.whatsapp",
        "campaigns.recipientStatusWhatsApp.opened",
        "campaigns.recipientStatusWhatsApp.bounced",
        "campaigns.detail.columnsPhone",
        "campaigns.table.openedOrRead",
      ]) {
        expect(messages[key]).toBeTruthy();
      }
    }
  });

  test("the contact card's unreachable-number strings exist in both languages", () => {
    for (const messages of [locales.es, locales.en]) {
      for (const key of [
        "unreachable",
        "unreachableWhy",
        "unreachableReset",
        "unreachableConfirm",
        "unreachableConfirmYes",
        "unreachableResetting",
        "unreachableError",
      ]) {
        expect(messages[`contacts.detail.whatsapp.${key}`]).toBeTruthy();
      }
    }
  });

  test("the kinds WhatsApp refuses are hidden, so no string explains them any more", () => {
    for (const messages of [locales.es, locales.en]) {
      expect(
        Object.keys(messages).filter((key) =>
          key.startsWith("campaigns.type.whatsappUnavailable"),
        ),
      ).toEqual([]);
    }
  });

  test("every error the actions and the save can return is translated", () => {
    const keys = [
      "no_phone",
      "test_rate_limited",
      "meta",
      "whatsapp_not_configured",
      "template_unavailable",
      "locked",
      "invalid",
    ];
    for (const messages of [locales.es, locales.en]) {
      for (const key of keys) {
        expect(messages[`campaigns.errors.${key}`]).toBeTruthy();
      }
      for (const key of [
        "templateRequired",
        "templateUnavailable",
        "paramCountMismatch",
        "paramTooLong",
        "kindNotAllowedForChannel",
      ]) {
        expect(messages[`validation.${key}`]).toBeTruthy();
      }
    }
  });
});

describe("the appointment notice strings", () => {
  const KEYS = [
    "campaigns.type.appointment",
    "campaigns.type.appointmentDesc",
    "campaigns.type.kindLocked",
    "campaigns.trigger.event.before_visit",
    "campaigns.trigger.event.after_visit",
    "campaigns.trigger.appointment.side",
    "campaigns.trigger.appointment.before",
    "campaigns.trigger.appointment.after",
    "campaigns.trigger.appointment.hoursBefore",
    "campaigns.trigger.appointment.hoursAfter",
    "campaigns.trigger.appointment.unit",
    "campaigns.trigger.appointment.shortcuts",
    "campaigns.trigger.appointment.sentenceBefore",
    "campaigns.trigger.appointment.sentenceAfter",
    "campaigns.trigger.appointment.sentenceInvalid",
    "campaigns.trigger.appointment.rules",
    "campaigns.trigger.appointment.delay",
    "campaigns.trigger.appointment.grace",
    "campaigns.audience.reachFailed",
    "campaigns.audience.reachRetry",
    "validation.invalidInput",
    "campaigns.trigger.appointment.shortBefore",
    "campaigns.trigger.appointment.shortAfter",
    "campaigns.audience.appointment.title",
    "campaigns.audience.appointment.anyService",
    "campaigns.steps.appointmentAudience",
    "campaigns.form.whatsapp.languageHintAppointment",
    "campaigns.form.whatsapp.sentInAppointment",
    "campaigns.audience.appointment.services",
    "campaigns.audience.appointment.servicesHelp",
    "campaigns.audience.appointment.language",
    "campaigns.audience.appointment.languageHint",
    "campaigns.audience.appointment.reach",
    "campaigns.audience.appointment.note",
    "campaigns.audience.appointment.panelNote",
    "campaigns.form.whatsapp.appointmentCategoryHint",
    "validation.templateCategoryNotAllowed",
    "campaigns.review.noConditionsAppointment",
    "campaigns.review.appointmentPace",
    "campaigns.review.emptyAppointment",
    "campaigns.detail.columnsAppointment",
    "messages.email.reminder.forWhatsApp",
    "messages.email.whatsapp.campaignNote",
    "messages.email.whatsapp.campaignLink",
  ];

  test("every string the screens read is there, in both languages", () => {
    for (const locale of ["es", "en"] as const) {
      expect(KEYS.filter((key) => !locales[locale][key])).toEqual([]);
    }
  });

  test("the sentences carry the hours and the error carries both limits", () => {
    for (const locale of ["es", "en"] as const) {
      for (const key of [
        "sentenceBefore",
        "sentenceAfter",
        "shortBefore",
        "shortAfter",
      ]) {
        expect(
          locales[locale][`campaigns.trigger.appointment.${key}`],
        ).toContain("{hours}");
      }
      const invalid =
        locales[locale]["campaigns.trigger.appointment.sentenceInvalid"];
      expect(invalid).toContain("{min}");
      expect(invalid).toContain("{max}");
    }
  });

  test("the sentences read as the brief wrote them", () => {
    const say = (key: string, hours: number) =>
      new IntlMessageFormat(
        locales.es[`campaigns.trigger.appointment.${key}`],
        "es",
      ).format({ hours });
    expect(say("sentenceBefore", 48)).toBe(
      "Se enviará 48 h antes de cada cita.",
    );
    expect(say("sentenceAfter", 2)).toBe(
      "Se enviará 2 h después de que termine cada cita.",
    );
    expect(say("shortBefore", 48)).toBe("48 h antes de la cita");
  });

  test("the reminder switch points to the campaign and no longer talks of a WhatsApp reminder of its own", () => {
    expect(locales.es["messages.email.reminder.forWhatsApp"]).toContain(
      "Aviso de cita",
    );
    expect(locales.en["messages.email.reminder.forWhatsApp"]).toContain(
      "Appointment notice",
    );
    for (const locale of ["es", "en"] as const) {
      expect(locales[locale]["messages.email.reminder.turnedOff"]).not.toMatch(
        /WhatsApp/,
      );
      expect(
        locales[locale]["messages.email.whatsapp.when.booking_reminder"],
      ).toBeUndefined();
      expect(
        locales[locale]["messages.email.whatsapp.rules.reminderFirst"],
      ).toBeUndefined();
      expect(
        locales[locale]["messages.email.whatsapp.rules.languagesReminder"],
      ).toBeUndefined();
    }
  });
});

describe("the appointment notice talks of no segment", () => {
  test("the language texts, the folded audience row and the audience step never say segment", () => {
    for (const locale of ["es", "en"] as const) {
      for (const key of [
        "campaigns.form.whatsapp.languageHintAppointment",
        "campaigns.form.whatsapp.sentInAppointment",
        "campaigns.steps.appointmentAudience",
        "campaigns.audience.appointment.languageHint",
      ]) {
        expect(locales[locale][key]).not.toMatch(/segment/i);
      }
    }
    expect(locales.es["campaigns.steps.appointmentAudience"]).toBe(
      "Servicios y clientas",
    );
  });
});

describe("the Utility-only rule and the card, in words", () => {
  test("the card promises a reminder or a follow-up, not a review or aftercare, which are marketing", () => {
    for (const locale of ["es", "en"] as const) {
      expect(locales[locale]["campaigns.type.appointmentDesc"]).not.toMatch(
        /rese[ñn]a|review|cuidados|aftercare/i,
      );
      expect(
        locales[locale]["campaigns.form.whatsapp.appointmentCategoryHint"],
      ).toMatch(/Utilidad|Utility/);
    }
    expect(locales.es["campaigns.type.appointmentDesc"]).toBe(
      "Un mensaje de WhatsApp antes o después de cada cita: recordatorio o seguimiento. Solo a quien aceptó los avisos de la cita.",
    );
  });
  test("the refusal names the category in both languages", () => {
    expect(locales.es["validation.templateCategoryNotAllowed"]).toContain(
      "Marketing",
    );
    expect(locales.en["validation.templateCategoryNotAllowed"]).toContain(
      "Marketing",
    );
  });
});

describe("the note on who each channel writes to", () => {
  test("is there in both languages and the old channel hint is gone", () => {
    for (const locale of ["es", "en"] as const) {
      expect(
        locales[locale]["campaigns.type.consentNoteWhatsApp"],
      ).toBeTruthy();
      expect(locales[locale]["campaigns.type.consentNoteEmail"]).toBeTruthy();
      expect(locales[locale]["campaigns.type.channelHint"]).toBeUndefined();
    }
  });
  test("WhatsApp names the exception, by the type's own name", () => {
    expect(locales.es["campaigns.type.consentNoteWhatsApp"]).toContain(
      locales.es["campaigns.type.appointment"],
    );
    expect(locales.en["campaigns.type.consentNoteWhatsApp"]).toContain(
      locales.en["campaigns.type.appointment"],
    );
  });
  test("email names the audience filter exactly as the screen shows it, and does not claim a consent it does not require", () => {
    for (const locale of ["es", "en"] as const) {
      const note = locales[locale]["campaigns.type.consentNoteEmail"];
      expect(note).toContain(
        locales[locale]["campaigns.audience.subscriptionOnly"],
      );
      expect(note).toContain(
        locales[locale]["campaigns.audience.subscription"],
      );
    }
    expect(locales.es["campaigns.type.consentNoteEmail"]).not.toMatch(
      /solo escribe a quien acept/i,
    );
  });
});
