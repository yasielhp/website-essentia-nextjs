import { describe, expect, it } from "bun:test";
import { createTranslator } from "next-intl";
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

describe("the dialog that asks before a reset or a removal", () => {
  const ask = (
    locale: "es" | "en",
    path: string,
    values: Record<string, string>,
  ) =>
    createTranslator({
      locale,
      messages: { dashboard: LOCALES[locale] },
      namespace: "dashboard.messages.email",
    })(path as never, values as never) as string;

  it("names the message and the language of an email, in both languages", () => {
    expect(
      ask("es", "resetDialog.title", {
        name: "Reserva recibida",
        language: "Español",
      }),
    ).toBe("¿Restablecer «Reserva recibida» en Español?");
    expect(
      ask("en", "resetDialog.title", {
        name: "Booking received",
        language: "English",
      }),
    ).toBe("Reset “Booking received” in English?");
  });

  it("names the message whose WhatsApp setup goes", () => {
    expect(
      ask("es", "whatsapp.removeTitle", { name: "Reserva confirmada" }),
    ).toBe("¿Quitar la configuración de WhatsApp de «Reserva confirmada»?");
    expect(
      ask("en", "whatsapp.removeTitle", { name: "Booking confirmed" }),
    ).toBe("Remove the WhatsApp setup of “Booking confirmed”?");
  });

  for (const locale of ["es", "en"] as const) {
    it(`${locale}: the text, the note and the buttons exist, and the old inline question is gone`, () => {
      const email = LOCALES[locale].messages.email as Record<string, unknown>;
      const dialog = email.resetDialog as Record<string, string>;
      for (const key of ["title", "body", "keepsOff", "yes"]) {
        expect(dialog[key]?.trim()).toBeTruthy();
      }
      expect(email.resetConfirm).toBeUndefined();
      expect(email.resetYes).toBeUndefined();
      const whatsapp = email.whatsapp as Record<string, string>;
      for (const key of [
        "removeTitle",
        "removeConfirm",
        "removeYes",
        "removeNo",
      ]) {
        expect(whatsapp[key]?.trim()).toBeTruthy();
      }
    });
  }
});
