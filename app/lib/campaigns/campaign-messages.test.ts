import { describe, expect, test } from "bun:test";
import { IntlMessageFormat } from "intl-messageformat";
import { formatsCleanly } from "@/lib/icu-sample";
import es from "../../../messages/es/dashboard.json";
import en from "../../../messages/en/dashboard.json";
import { REPORT_NOTE_KEYS } from "./report";
import { TEMPLATE_CHOICE_ISSUES } from "./whatsapp-eligibility";
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
