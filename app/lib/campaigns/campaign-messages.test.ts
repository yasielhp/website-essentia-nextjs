import { describe, expect, test } from "bun:test";
import { IntlMessageFormat } from "intl-messageformat";
import es from "../../../messages/es/dashboard.json";
import en from "../../../messages/en/dashboard.json";
import { TEMPLATE_CHOICE_ISSUES } from "./whatsapp-eligibility";
import { PARAM_FIELDS, kindAllowedForChannel } from "./whatsapp-form";

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

  test("every string is valid ICU", () => {
    const broken: string[] = [];
    for (const locale of ["es", "en"] as const) {
      for (const [key, value] of Object.entries(inGroups(locales[locale]))) {
        try {
          new IntlMessageFormat(value, locale);
        } catch {
          broken.push(`${locale}:${key}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  test("the new WhatsApp strings format with the values the form gives them", () => {
    const values = {
      count: 3,
      n: 1,
      language: "x",
      reason: "r",
      example: "e",
      name: "n",
      sent: 1,
      remaining: 2,
      phone: "+34",
      en: 1,
      es: 2,
    };
    const broken: string[] = [];
    for (const locale of ["es", "en"] as const) {
      for (const [key, value] of Object.entries(locales[locale])) {
        const watched =
          key.startsWith("campaigns.form.whatsapp.") ||
          key.startsWith("campaigns.review.whatsapp") ||
          key.startsWith("campaigns.audience.reachWhatsApp") ||
          [
            "toasts.sendPartial",
            "toasts.sendHalted",
            "toasts.sendUnrecorded",
            "toasts.campaignTestSentPhone",
          ].includes(key);
        if (!watched) continue;
        try {
          new IntlMessageFormat(value, locale).format(values);
        } catch {
          broken.push(`${locale}:${key}`);
        }
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
      for (const issue of TEMPLATE_CHOICE_ISSUES) {
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

  test("every kind WhatsApp refuses says why on its card", () => {
    const refused = (["split", "rss"] as const).filter(
      (kind) => !kindAllowedForChannel(kind, "whatsapp"),
    );
    expect(refused).toEqual(["split", "rss"]);
    for (const messages of [locales.es, locales.en]) {
      for (const kind of refused) {
        expect(
          messages[`campaigns.type.whatsappUnavailable.${kind}`],
        ).toBeTruthy();
      }
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
