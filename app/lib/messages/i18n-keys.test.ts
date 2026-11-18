import { describe, expect, it } from "bun:test";
import en from "../../../messages/en/dashboard.json";
import es from "../../../messages/es/dashboard.json";
import { MESSAGE_VALIDATION_KEYS } from "./schema";
import { MESSAGE_ACTION_ERROR_KEYS } from "./types";

const LOCALES = { en, es } as const;

describe("the keys the message actions can answer with are translated", () => {
  for (const [locale, messages] of Object.entries(LOCALES)) {
    it(`${locale}: every validation key has text`, () => {
      const validation = messages.validation as Record<string, string>;
      for (const key of MESSAGE_VALIDATION_KEYS) {
        expect(validation[key]?.trim() ?? "").not.toBe("");
      }
    });

    it(`${locale}: every action error has text`, () => {
      const errors = messages.messages.email.errors as Record<string, string>;
      for (const key of MESSAGE_ACTION_ERROR_KEYS) {
        expect(errors[key]?.trim() ?? "").not.toBe("");
      }
    });
  }
});

describe("each variable has a long name and a short one", () => {
  for (const [locale, messages] of Object.entries(LOCALES)) {
    it(`${locale}: the short names cover the same variables as the long ones, no more, no fewer`, () => {
      const email = messages.messages.email as {
        variables: Record<string, string>;
        variableShort: Record<string, string>;
      };
      expect(Object.keys(email.variableShort).sort()).toEqual(
        Object.keys(email.variables).sort(),
      );
      for (const [name, short] of Object.entries(email.variableShort)) {
        expect(short.trim()).not.toBe("");
        // Short is for a chip in a line of text: never longer than the long one.
        expect(short.length).toBeLessThanOrEqual(email.variables[name]!.length);
        expect(short.length).toBeLessThanOrEqual(16);
      }
    });
  }
});
