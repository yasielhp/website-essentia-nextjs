import { describe, expect, test } from "bun:test";
import { EMPTY_AUDIENCE } from "@/types/campaign";
import { validateCampaign } from "@/lib/schemas";
import es from "../../../messages/es/dashboard.json";
import en from "../../../messages/en/dashboard.json";
import {
  CAMPAIGN_LOCALES,
  INCOMPLETE_ERRORS,
  audienceLocales,
  incompleteError,
  missingLocales,
  recipientLocale,
} from "./languages";

const any = { ...EMPTY_AUDIENCE, language: "any" as const };

describe("audienceLocales", () => {
  test("an audience that spans both languages is written in both, Spanish first", () => {
    expect(audienceLocales(any)).toEqual(["es", "en"]);
    expect(CAMPAIGN_LOCALES).toEqual(["es", "en"]);
  });

  test("an audience that fixes a language is written in that one alone", () => {
    expect(audienceLocales({ language: "es" })).toEqual(["es"]);
    expect(audienceLocales({ language: "en" })).toEqual(["en"]);
  });

  test("the send language an older campaign chose no longer narrows it", () => {
    expect(audienceLocales({ ...any, sendLocale: "en" } as typeof any)).toEqual(
      ["es", "en"],
    );
  });
});

describe("recipientLocale", () => {
  test("with both languages, each contact gets her own", () => {
    expect(recipientLocale(any, "es")).toBe("es");
    expect(recipientLocale(any, "en")).toBe("en");
  });

  test("a contact with no language, or an odd one, reads as English: the rule the language filter and the counts already use", () => {
    expect(recipientLocale(any, null)).toBe("en");
    expect(recipientLocale(any, undefined)).toBe("en");
    expect(recipientLocale(any, "fr")).toBe("en");
    expect(recipientLocale(any, "")).toBe("en");
  });

  test("an audience that fixes a language writes to everybody in it, whoever they are", () => {
    // A contact picked by hand into a Spanish segment: there is no English
    // version to send her.
    expect(recipientLocale({ language: "es" }, "en")).toBe("es");
    expect(recipientLocale({ language: "en" }, "es")).toBe("en");
    expect(recipientLocale({ language: "en" }, null)).toBe("en");
  });
});

describe("missingLocales", () => {
  test("names the languages whose version has an error, in the house order", () => {
    expect(
      missingLocales({
        "content.en.subject": "subjectRequired",
        "content.en.doc": "bodyRequired",
      }),
    ).toEqual(["en"]);
    expect(
      missingLocales({
        "content.en.title": "titleRequired",
        "content.es.subject": "subjectRequired",
      }),
    ).toEqual(["es", "en"]);
  });

  test("a WhatsApp template missing in a language counts as that language", () => {
    expect(
      missingLocales({ "content.whatsapp.en.templateId": "templateRequired" }),
    ).toEqual(["en"]);
  });

  test("an error that is nobody's language names none", () => {
    expect(missingLocales({ name: "nameRequired" })).toEqual([]);
    expect(missingLocales({})).toEqual([]);
  });
});

describe("incompleteError", () => {
  test("says which version is missing when that is what is wrong", () => {
    expect(incompleteError({ "content.en.subject": "subjectRequired" })).toBe(
      "missing_en",
    );
    expect(incompleteError({ "content.es.doc": "bodyRequired" })).toBe(
      "missing_es",
    );
    expect(
      incompleteError({
        "content.es.doc": "bodyRequired",
        "content.whatsapp.en.templateId": "templateRequired",
      }),
    ).toBe("missing_both");
  });

  test("anything else is the plain 'check the fields'", () => {
    expect(incompleteError({ name: "nameRequired" })).toBe("invalid");
    expect(incompleteError({})).toBe("invalid");
  });

  test("a version that is all written but wrong has errors, it is not missing", () => {
    expect(incompleteError({ "content.en.subject": "subjectTooLong" })).toBe(
      "errors_en",
    );
    expect(
      incompleteError({
        "content.es.preheader": "preheaderTooLong",
        "content.en.title": "titleTooLong",
      }),
    ).toBe("errors_both");
    expect(
      incompleteError({ "content.whatsapp.es.params.0": "paramTooLong" }),
    ).toBe("errors_es");
  });

  test("an empty field anywhere in a version makes it missing, whatever else is wrong in it", () => {
    expect(
      incompleteError({
        "content.en.subject": "subjectTooLong",
        "content.en.doc": "bodyRequired",
      }),
    ).toBe("missing_en");
  });

  test("one missing and the other with errors: the refusal says both", () => {
    expect(
      incompleteError({
        "content.es.doc": "bodyRequired",
        "content.en.subject": "subjectTooLong",
      }),
    ).toBe("missing_es_errors_en");
    expect(
      incompleteError({
        "content.es.subject": "subjectTooLong",
        "content.whatsapp.en.templateId": "templateRequired",
      }),
    ).toBe("missing_en_errors_es");
  });

  test("on what the real validation says of a subject too long", () => {
    const tooLong = "x".repeat(121);
    const written = (subject: string) => ({
      subject,
      preheader: "",
      title: "Título",
      doc: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Hola" }] },
        ],
      },
    });
    const check = validateCampaign({
      name: "Reapertura",
      channel: "email",
      kind: "standard",
      trigger: {},
      audience: { ...EMPTY_AUDIENCE, language: "any" },
      content: { es: written("Hola"), en: written(tooLong) },
    });
    expect(check.ok).toBe(false);
    if (!check.ok) expect(incompleteError(check.errors)).toBe("errors_en");
  });

  test("every answer has its sentence, in Spanish and in English", () => {
    for (const messages of [es, en]) {
      const errors = messages.campaigns.errors as Record<string, string>;
      for (const code of INCOMPLETE_ERRORS) {
        expect([code, Boolean(errors[code])]).toEqual([code, true]);
      }
    }
    expect((es.campaigns.errors as Record<string, string>).errors_en).toBe(
      "La versión en inglés tiene errores: revisa los campos marcados.",
    );
  });
});
