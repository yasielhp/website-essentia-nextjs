import { describe, expect, test } from "bun:test";
import { validateCampaign } from "@/lib/schemas";
import { EMPTY_AUDIENCE, EMPTY_LOCALE_CONTENT } from "@/types/campaign";
import { docIsEmpty } from "./doc";
import {
  anyWords,
  hasWords,
  previousVersions,
  templateVersions,
} from "./starting-content";
import { CAMPAIGN_TEMPLATES } from "./templates";

describe("a house template fills both languages", () => {
  test.each(CAMPAIGN_TEMPLATES.map((t) => [t.id, t] as const))(
    "%s: a subject, a title and a body in Spanish and in English",
    (_id, template) => {
      const versions = templateVersions(template);
      for (const locale of ["es", "en"] as const) {
        expect(versions[locale].subject.trim()).not.toBe("");
        expect(versions[locale].title.trim()).not.toBe("");
        expect(docIsEmpty(versions[locale].doc)).toBe(false);
      }
      // Two texts, not one copied: the English is not the Spanish.
      expect(versions.en.subject).not.toBe(versions.es.subject);
    },
  );

  test.each(CAMPAIGN_TEMPLATES.map((t) => [t.id, t] as const))(
    "%s: a campaign for everybody, started from it, can go out as it is",
    (_id, template) => {
      const result = validateCampaign({
        name: "Desde una plantilla",
        kind: "standard",
        trigger: {},
        audience: { ...EMPTY_AUDIENCE, language: "any" },
        content: templateVersions(template),
      });
      expect(result.ok).toBe(true);
    },
  );
});

describe("a campaign already written, as a starting point", () => {
  const written = {
    subject: "Hola",
    preheader: "",
    title: "Hola",
    doc: {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Hola." }] },
      ],
    },
  };

  test("brings its two versions", () => {
    const en = { ...written, subject: "Hello" };
    const versions = previousVersions({ es: written, en });
    expect(versions.es).toEqual(written);
    expect(versions.en).toEqual(en);
  });

  test("they are copies: editing the new campaign does not touch the old", () => {
    const versions = previousVersions({ es: written, en: written });
    expect(versions.es).not.toBe(written);
    expect(versions.es.doc).not.toBe(written.doc);
  });

  test("a version it never had starts empty", () => {
    const versions = previousVersions({ es: written });
    expect(versions.en).toEqual(EMPTY_LOCALE_CONTENT);
  });
});

describe("whether something is written", () => {
  test("an untouched version has no words", () => {
    expect(hasWords(EMPTY_LOCALE_CONTENT)).toBe(false);
    expect(hasWords(undefined)).toBe(false);
    expect(hasWords({ ...EMPTY_LOCALE_CONTENT, subject: "  " })).toBe(false);
  });

  test("a subject alone is something", () => {
    expect(hasWords({ ...EMPTY_LOCALE_CONTENT, subject: "Hola" })).toBe(true);
  });

  test("a campaign has words when either language has", () => {
    expect(
      anyWords({ es: EMPTY_LOCALE_CONTENT, en: EMPTY_LOCALE_CONTENT }),
    ).toBe(false);
    expect(
      anyWords({
        es: EMPTY_LOCALE_CONTENT,
        en: { ...EMPTY_LOCALE_CONTENT, title: "Hello" },
      }),
    ).toBe(true);
  });
});
