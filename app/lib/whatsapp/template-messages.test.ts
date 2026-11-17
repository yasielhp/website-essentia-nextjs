import { describe, expect, test } from "bun:test";
import { IntlMessageFormat } from "intl-messageformat";
import es from "../../../messages/es/dashboard.json";
import en from "../../../messages/en/dashboard.json";
import { TEMPLATE_MESSAGE_KEYS } from "@/lib/schemas";
import {
  TEMPLATE_STATUSES,
  UNSUPPORTED_REASONS,
} from "@/lib/whatsapp/template-ui";
import { WHATSAPP_TEMPLATE_CATEGORIES } from "@/lib/whatsapp/types";

type Tree = { [key: string]: string | Tree };

/** Every leaf as a dotted path, so the two languages compare key by key. */
function leaves(tree: Tree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out[path] = value;
    else Object.assign(out, leaves(value, path));
  }
  return out;
}

const locales = { es: es as unknown as Tree, en: en as unknown as Tree };

/** The error keys `app/actions/whatsapp-templates.ts` can answer with. */
const ACTION_ERRORS = [
  "db",
  "invalid",
  "templateExists",
  "submittedNotSaved",
  "whatsapp_not_configured",
  "meta",
];

describe("the Messages screen strings", () => {
  const esMessages = leaves(locales.es.messages as Tree, "messages");
  const enMessages = leaves(locales.en.messages as Tree, "messages");

  test("the same keys exist in Spanish and English", () => {
    expect(Object.keys(enMessages).sort()).toEqual(
      Object.keys(esMessages).sort(),
    );
  });

  test("no string is empty", () => {
    for (const messages of [esMessages, enMessages]) {
      for (const [key, value] of Object.entries(messages)) {
        expect([key, value.trim().length > 0]).toEqual([key, true]);
      }
    }
  });

  test("every string is valid ICU, so a stray brace cannot crash the page", () => {
    const sample = {
      count: 2,
      n: 1,
      name: "x",
      date: "17 nov 2026",
      reason: "r",
    };
    const broken: string[] = [];
    for (const [locale, messages] of [
      ["es", esMessages],
      ["en", enMessages],
    ] as const) {
      for (const [key, value] of Object.entries(messages)) {
        try {
          new IntlMessageFormat(value, locale).format(sample);
        } catch {
          broken.push(`${locale}:${key}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  test("every state Meta reports has a label", () => {
    for (const messages of [esMessages, enMessages]) {
      for (const status of TEMPLATE_STATUSES) {
        expect(messages[`messages.whatsapp.status.${status}`]).toBeTruthy();
      }
    }
  });

  test("every unsupported reason has its sentence", () => {
    for (const messages of [esMessages, enMessages]) {
      for (const reason of UNSUPPORTED_REASONS) {
        expect(
          messages[`messages.whatsapp.unsupported.${reason}`],
        ).toBeTruthy();
      }
    }
  });

  test("every category has a label", () => {
    for (const messages of [esMessages, enMessages]) {
      for (const category of WHATSAPP_TEMPLATE_CATEGORIES) {
        expect(
          messages[`messages.whatsapp.categories.${category}`],
        ).toBeTruthy();
      }
    }
  });

  test("every error key the actions return is translated", () => {
    for (const messages of [esMessages, enMessages]) {
      for (const key of [...ACTION_ERRORS, "generic"]) {
        expect(messages[`messages.whatsapp.errors.${key}`]).toBeTruthy();
      }
    }
  });
});

describe("the template validation messages", () => {
  const es = locales.es.validation as Tree;
  const en = locales.en.validation as Tree;

  test("every key the schema can raise exists in both languages", () => {
    expect(TEMPLATE_MESSAGE_KEYS.size).toBe(24);
    for (const key of TEMPLATE_MESSAGE_KEYS) {
      expect([key, typeof es[key]]).toEqual([key, "string"]);
      expect([key, typeof en[key]]).toEqual([key, "string"]);
    }
    expect(typeof es.invalidInput).toBe("string");
    expect(typeof en.invalidInput).toBe("string");
  });

  test("the placeholders are shown literally, not eaten by ICU", () => {
    const shown = new IntlMessageFormat(es.paramMalformed as string, "es");
    expect(shown.format({})).toContain("{{1}}, {{2}}");
    const gap = new IntlMessageFormat(en.paramGap as string, "en");
    expect(gap.format({})).toContain("{{1}}, {{2}}, {{3}}");
  });
});

describe("navigation", () => {
  test("the sidebar and breadcrumb entries exist in both languages", () => {
    for (const locale of [locales.es, locales.en]) {
      expect((locale.nav as Tree).messages).toBeTruthy();
      expect(
        ((locale.breadcrumbs as Tree).sections as Tree).messages,
      ).toBeTruthy();
    }
  });
});
