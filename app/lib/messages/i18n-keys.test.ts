import { describe, expect, it } from "bun:test";
import { createTranslator } from "next-intl";
import { MESSAGE_KEYS } from "./catalog";
import { WHATSAPP_MESSAGE_KEYS } from "./whatsapp-row";
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

describe("the words of the kicker", () => {
  for (const locale of ["es", "en"] as const) {
    it(`${locale}: the name, the faint line that says where to write, and the errors exist`, () => {
      const editor = LOCALES[locale].messages.email.editor as unknown as Record<
        string,
        string
      >;
      for (const key of ["kickerLabel", "kickerPlaceholder"]) {
        expect(editor[key]?.trim()).toBeTruthy();
      }
      const validation = LOCALES[locale].validation as Record<string, string>;
      for (const key of ["kickerOne", "kickerMisplaced"]) {
        expect(validation[key]?.trim()).toBeTruthy();
      }
    });
  }
});

describe("the question before a message is switched off", () => {
  const ask = (
    locale: "es" | "en",
    path: string,
    values: Record<string, string> = {},
  ) =>
    createTranslator({
      locale,
      messages: { dashboard: LOCALES[locale] },
      namespace: "dashboard.messages.email",
    })(path as never, values as never) as string;

  it("names the message and its channel, in both languages", () => {
    expect(
      ask("es", "switch.offDialog.title", {
        name: "Pago de la reserva confirmado",
        type: "correo",
      }),
    ).toBe("¿Apagar «Pago de la reserva confirmado» (correo)?");
    expect(
      ask("en", "switch.offDialog.title", {
        name: "Booking paid",
        type: "email",
      }),
    ).toBe("Switch off “Booking paid” (email)?");
    expect(
      ask("es", "switch.label", { name: "Reserva recibida", type: "correo" }),
    ).toBe("Activar Reserva recibida, correo");
  });

  for (const locale of ["es", "en"] as const) {
    it(`${locale}: every message and channel says what turning it off will stop, each in its own words`, () => {
      const bodies = (
        LOCALES[locale].messages.email as unknown as {
          switch: {
            offDialog: { body: Record<string, Record<string, string>> };
          };
        }
      ).switch.offDialog.body;
      const email = MESSAGE_KEYS.map((key) => bodies.email?.[key]);
      for (const text of email) expect(text?.trim()).toBeTruthy();
      expect(new Set(email).size).toBe(MESSAGE_KEYS.length);
      for (const key of WHATSAPP_MESSAGE_KEYS) {
        expect(bodies.whatsapp?.[key]?.trim()).toBeTruthy();
      }
      // Nothing for a WhatsApp message there is no switch for.
      expect(Object.keys(bodies.whatsapp ?? {}).sort()).toEqual(
        [...WHATSAPP_MESSAGE_KEYS].sort(),
      );
    });
  }

  it("the paid confirmation, the consent request and the reminder say the concrete thing", () => {
    expect(ask("es", "switch.offDialog.body.email.booking_paid")).toBe(
      "Las clientas que paguen online no recibirán la confirmación de su pago.",
    );
    expect(ask("es", "switch.offDialog.body.email.consent_request")).toBe(
      "La solicitud de consentimiento no se podrá enviar desde la ficha del contacto.",
    );
    expect(ask("es", "switch.offDialog.body.email.booking_reminder")).toBe(
      "No se enviará el recordatorio por correo antes de cada cita.",
    );
  });
});

describe("the switch's column and its reason when it cannot be pressed", () => {
  for (const [locale, header, content, reason] of [
    [
      "es",
      "Estado",
      "Contenido",
      "Configura la plantilla de WhatsApp para poder activarlo.",
    ],
    ["en", "Status", "Content", "Set up the WhatsApp template to turn it on."],
  ] as const) {
    it(`${locale}: the switch's column is State, the old State is Content, and the reason is said`, () => {
      const email = LOCALES[locale].messages.email as unknown as {
        columns: Record<string, string>;
        switch: Record<string, string>;
      };
      expect(email.columns.switch).toBe(header);
      expect(email.columns.content).toBe(content);
      // No two columns of one name, and nothing left of the old keys.
      expect(email.columns.status).toBeUndefined();
      expect(email.columns.active).toBeUndefined();
      expect(email.switch.needsSetup).toBe(reason);
    });
  }
});
