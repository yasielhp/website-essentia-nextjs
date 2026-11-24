import { describe, expect, test } from "bun:test";
import { EMPTY_AUDIENCE } from "@/types/campaign";
import {
  isOldWhatsAppShape,
  toWhatsAppContent,
  whatsappBlocks,
} from "./whatsapp-content";

const everybody = { ...EMPTY_AUDIENCE, language: "any" as const };
const name = { kind: "field" as const, field: "first_name" as const };
const es = { templateId: "tpl-es", params: [name] };
const en = { templateId: "tpl-en", params: [name, name] };

describe("whatsappBlocks: a template per language", () => {
  test("the new shape is read as it is", () => {
    expect(whatsappBlocks({ es, en }, everybody)).toEqual({ es, en });
  });

  test("a language with no template is null, not an empty one", () => {
    expect(whatsappBlocks({ es }, everybody)).toEqual({ es, en: null });
    expect(whatsappBlocks(undefined, everybody)).toEqual({
      es: null,
      en: null,
    });
    expect(whatsappBlocks(null, everybody)).toEqual({ es: null, en: null });
  });

  test("each language has its own parameters", () => {
    const blocks = whatsappBlocks({ es, en }, everybody);
    expect(blocks.es?.params).toHaveLength(1);
    expect(blocks.en?.params).toHaveLength(2);
  });
});

describe("a block saved when a campaign had one language", () => {
  const old = { templateId: "tpl-1", params: [name] };

  test("is recognised: a template with no language", () => {
    expect(isOldWhatsAppShape(old)).toBe(true);
    expect(isOldWhatsAppShape({ templateId: null, params: [] })).toBe(true);
    expect(isOldWhatsAppShape({ es, en })).toBe(false);
    expect(isOldWhatsAppShape({})).toBe(false);
    expect(isOldWhatsAppShape(undefined)).toBe(false);
  });

  test("is the template of the language the audience fixed", () => {
    expect(whatsappBlocks(old, { ...everybody, language: "en" })).toEqual({
      es: null,
      en: old,
    });
    expect(whatsappBlocks(old, { ...everybody, language: "es" })).toEqual({
      es: old,
      en: null,
    });
  });

  test("or, for everybody, of the send language it had chosen", () => {
    expect(whatsappBlocks(old, { ...everybody, sendLocale: "en" })).toEqual({
      es: null,
      en: old,
    });
  });

  test("or of Spanish, the house default, when it had chosen none", () => {
    expect(whatsappBlocks(old, everybody)).toEqual({ es: old, en: null });
  });

  test("the language the audience fixes wins over the old choice", () => {
    expect(
      whatsappBlocks(old, { ...everybody, language: "es", sendLocale: "en" }),
    ).toEqual({ es: old, en: null });
  });

  test("a new-shape block is never mistaken for it, even with old keys left beside it", () => {
    expect(whatsappBlocks({ ...old, en }, everybody)).toEqual({
      es: null,
      en,
    });
  });
});

describe("toWhatsAppContent: what the form writes", () => {
  test("only the languages that have something, in the new shape", () => {
    expect(toWhatsAppContent({ es, en: null })).toEqual({ es });
    expect(toWhatsAppContent({ es, en })).toEqual({ es, en });
    expect(toWhatsAppContent({ es: null, en: null })).toEqual({});
  });

  test("reading an old block and writing it back gives the new shape", () => {
    const old = { templateId: "tpl-1", params: [name] };
    expect(toWhatsAppContent(whatsappBlocks(old, everybody))).toEqual({
      es: old,
    });
  });
});
