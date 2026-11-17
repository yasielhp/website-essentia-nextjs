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
