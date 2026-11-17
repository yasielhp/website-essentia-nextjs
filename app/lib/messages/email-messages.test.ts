import { describe, expect, it } from "bun:test";
import { formatsCleanly } from "@/lib/icu-sample";
import en from "../../../messages/en/dashboard.json";
import es from "../../../messages/es/dashboard.json";
import { MESSAGE_CATALOG, MESSAGE_KEYS } from "./catalog";
import { MESSAGE_ACTION_ERROR_KEYS } from "./types";
import { WHATSAPP_MESSAGE_KEYS } from "./whatsapp-row";

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

/** What the Emails tab reads: the names, the hints and the tab's own strings. */
function emailStrings(messages: unknown): Record<string, string> {
  const m = (messages as { messages: Tree }).messages;
  const suppression = (
    messages as {
      contacts: { detail: { whatsapp: { suppression: Tree } } };
    }
  ).contacts.detail.whatsapp.suppression;
  return {
    ...leaves(suppression, "contacts.detail.whatsapp.suppression"),
    ...leaves(m.keys as Tree, "messages.keys"),
    ...leaves(m.keyHints as Tree, "messages.keyHints"),
    ...leaves(m.email as Tree, "messages.email"),
  };
}

const LOCALES = { es: emailStrings(es), en: emailStrings(en) } as const;

describe("the Emails tab strings", () => {
  it("Spanish and English carry the same keys", () => {
    expect(Object.keys(LOCALES.en).sort()).toEqual(
      Object.keys(LOCALES.es).sort(),
    );
  });

  it("nothing is empty", () => {
    for (const messages of Object.values(LOCALES)) {
      for (const [key, value] of Object.entries(messages)) {
        expect([key, value.trim().length > 0]).toEqual([key, true]);
      }
    }
  });

  it("every string is valid ICU and formats with the values the tab gives it", () => {
    const broken: string[] = [];
    for (const locale of ["es", "en"] as const) {
      for (const [key, text] of Object.entries(LOCALES[locale])) {
        if (!formatsCleanly(text, locale)) broken.push(`${locale}:${key}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("every message has a readable name and a line on when it is sent", () => {
    for (const messages of Object.values(LOCALES)) {
      for (const key of MESSAGE_KEYS) {
        expect(messages[`messages.keys.${key}`]).toBeTruthy();
        expect(messages[`messages.keyHints.${key}`]).toBeTruthy();
      }
    }
  });

  it("every variable a message offers has a label, and every fixed block a name", () => {
    const variables = new Set<string>();
    const blocks = new Set<string>();
    for (const key of MESSAGE_KEYS) {
      for (const v of MESSAGE_CATALOG[key].variables) variables.add(v);
      for (const b of MESSAGE_CATALOG[key].fixed) blocks.add(b);
    }
    expect(variables.size).toBeGreaterThan(8);
    for (const messages of Object.values(LOCALES)) {
      for (const v of variables) {
        expect(messages[`messages.email.variables.${v}`]).toBeTruthy();
      }
      for (const b of blocks) {
        expect(messages[`messages.email.fixed.${b}`]).toBeTruthy();
      }
    }
  });

  it("every error an action can answer with is translated, with a generic fallback", () => {
    for (const messages of Object.values(LOCALES)) {
      for (const key of [...MESSAGE_ACTION_ERROR_KEYS, "generic"]) {
        expect(messages[`messages.email.errors.${key}`]).toBeTruthy();
      }
    }
  });

  it("the fixed-blocks warning names what the admin cannot move", () => {
    expect(LOCALES.es["messages.email.editor.fixedAfter"]).toContain("siempre");
    expect(LOCALES.en["messages.email.editor.fixedAfter"]).toContain("always");
  });

  it("every WhatsApp message says when it is sent", () => {
    for (const messages of Object.values(LOCALES)) {
      for (const key of WHATSAPP_MESSAGE_KEYS) {
        expect(messages[`messages.email.whatsapp.when.${key}`]).toBeTruthy();
      }
    }
  });

  it("every reason a WhatsApp row can be invalid, and every state, has words", () => {
    const issues = [
      "template_missing",
      "template_not_approved",
      "template_unsupported",
      "template_language",
      "param_count",
      "dynamic_url",
    ];
    const states = ["none", "off", "configured", "invalid", "unknown"];
    for (const messages of Object.values(LOCALES)) {
      for (const issue of issues) {
        expect(messages[`messages.email.whatsapp.issue.${issue}`]).toBeTruthy();
        // A wrong parameter count is not a reason a template is left out of
        // the list; it is a reason the saved choice stopped being valid.
        if (issue === "param_count") continue;
        expect(
          messages[`messages.email.whatsapp.editor.excluded.${issue}`],
        ).toBeTruthy();
      }
      for (const state of states) {
        expect(messages[`messages.email.whatsapp.state.${state}`]).toBeTruthy();
      }
    }
  });

  it("the rules the sender follows are written down in both languages", () => {
    for (const messages of Object.values(LOCALES)) {
      for (const rule of [
        "consent",
        "nothing",
        "languages",
        "stop",
        "reminderFirst",
        "noButtons",
      ]) {
        expect(messages[`messages.email.whatsapp.rules.${rule}`]).toBeTruthy();
      }
    }
    expect(LOCALES.es["messages.email.whatsapp.rules.stop"]).toContain("BAJA");
    expect(LOCALES.en["messages.email.whatsapp.rules.stop"]).toContain("STOP");
    expect(LOCALES.es["messages.email.whatsapp.rules.reminderFirst"]).toContain(
      "40-56",
    );
  });

  it("the card's STOP-list strings exist, with the confirmation", () => {
    for (const messages of Object.values(LOCALES)) {
      for (const key of [
        "note",
        "removeLabel",
        "removeConfirm",
        "removeYes",
        "removeNo",
        "removing",
        "error",
      ]) {
        expect(
          messages[`contacts.detail.whatsapp.suppression.${key}`],
        ).toBeTruthy();
      }
    }
  });

  it("only the reminder is a message that can be switched off, and the tab says so once", () => {
    const off = MESSAGE_KEYS.filter((k) => MESSAGE_CATALOG[k].canDisable);
    expect(off).toEqual(["booking_reminder"]);
  });
});
