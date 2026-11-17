import { describe, expect, test } from "bun:test";
import {
  validateWhatsAppTemplate,
  whatsappTemplateSchema,
} from "@/lib/schemas";

const valid = {
  name: "recordatorio_cita",
  language: "es" as const,
  category: "UTILITY" as const,
  headerText: "Tu cita",
  body: "Hola {{1}}, te esperamos el {{2}} en Essentia.",
  footerText: "Essentia",
  buttons: [
    { type: "URL" as const, text: "Ver cita", url: "https://essentia.es/cita" },
    { type: "QUICK_REPLY" as const, text: "Gracias" },
  ],
  exampleParams: ["Ana", "lunes"],
};

/** Every message the schema raised for one field, flattened. */
function messages(input: unknown, path?: string): string[] {
  const result = whatsappTemplateSchema.safeParse(input);
  if (result.success) return [];
  return result.error.issues
    .filter((i) => path === undefined || i.path.join(".") === path)
    .map((i) => i.message);
}

describe("whatsappTemplateSchema", () => {
  test("accepts a complete, valid template", () => {
    expect(whatsappTemplateSchema.safeParse(valid).success).toBe(true);
  });

  test("accepts a body with no placeholders and no examples", () => {
    const input = { ...valid, body: "Gracias por venir.", exampleParams: [] };
    expect(messages(input)).toEqual([]);
  });

  test("a name with capitals is templateNameFormat", () => {
    expect(messages({ ...valid, name: "Recordatorio" }, "name")).toEqual([
      "templateNameFormat",
    ]);
  });

  test("examples that do not match the parameter count are exampleCountMismatch", () => {
    expect(messages({ ...valid, exampleParams: ["Ana"] })).toEqual([
      "exampleCountMismatch",
    ]);
    expect(messages({ ...valid, exampleParams: ["Ana", "x", "y"] })).toEqual([
      "exampleCountMismatch",
    ]);
  });

  test("an http button URL is urlMustBeHttps", () => {
    const buttons = [
      { type: "URL" as const, text: "Ver", url: "http://essentia.es" },
    ];
    expect(messages({ ...valid, buttons })).toEqual(["urlMustBeHttps"]);
  });

  test("a placeholder at the edge of the body is paramAtEdge", () => {
    const input = {
      ...valid,
      body: "{{1}}, te esperamos el {{2}} en Essentia.",
    };
    expect(messages(input, "body")).toEqual(["paramAtEdge"]);
  });

  test("a gap in the numbering is paramGap", () => {
    const input = {
      ...valid,
      body: "Hola {{1}} y {{3}} gracias.",
      exampleParams: ["a", "b", "c"],
    };
    expect(messages(input, "body")).toEqual(["paramGap"]);
  });

  test("a malformed placeholder is paramMalformed", () => {
    const input = { ...valid, body: "Hola {{0}} gracias.", exampleParams: [] };
    expect(messages(input, "body")).toEqual(["paramMalformed"]);
  });

  test("a blank example is exampleRequired", () => {
    expect(messages({ ...valid, exampleParams: ["Ana", "  "] })).toContain(
      "exampleRequired",
    );
  });

  test("more than three buttons is tooManyButtons", () => {
    const button = { type: "QUICK_REPLY" as const, text: "Ok" };
    const buttons = [button, button, button, button];
    expect(messages({ ...valid, buttons })).toEqual(["tooManyButtons"]);
  });

  test("an unsupported category or language is rejected with a key", () => {
    expect(messages({ ...valid, category: "AUTHENTICATION" })).toEqual([
      "templateCategoryInvalid",
    ]);
    expect(messages({ ...valid, language: "fr" })).toEqual([
      "templateLanguageInvalid",
    ]);
  });

  test("a variable in the header is headerNoVariables", () => {
    expect(messages({ ...valid, headerText: "Hola {{1}}" })).toEqual([
      "headerNoVariables",
    ]);
  });

  test("a variable in the footer is footerNoVariables", () => {
    expect(messages({ ...valid, footerText: "Gracias {{1}}" })).toEqual([
      "footerNoVariables",
    ]);
  });

  test("a variable in a button URL is urlNoVariables", () => {
    const buttons = [
      {
        type: "URL" as const,
        text: "Ver",
        url: "https://essentia.es/cita/{{1}}",
      },
    ];
    expect(messages({ ...valid, buttons })).toEqual(["urlNoVariables"]);
  });

  describe("limits", () => {
    const at = (n: number, ch = "a") => ch.repeat(n);
    const plain = { ...valid, body: "Gracias por venir.", exampleParams: [] };

    test("name: 512 passes, 513 is templateNameTooLong", () => {
      expect(messages({ ...valid, name: at(512) }, "name")).toEqual([]);
      expect(messages({ ...valid, name: at(513) }, "name")).toEqual([
        "templateNameTooLong",
      ]);
    });

    test("body: 1024 passes, 1025 is templateBodyTooLong", () => {
      expect(messages({ ...plain, body: at(1024) }, "body")).toEqual([]);
      expect(messages({ ...plain, body: at(1025) }, "body")).toEqual([
        "templateBodyTooLong",
      ]);
    });

    test("header and footer: 60 passes, 61 is too long", () => {
      expect(messages({ ...valid, headerText: at(60) })).toEqual([]);
      expect(messages({ ...valid, headerText: at(61) })).toEqual([
        "headerTooLong",
      ]);
      expect(messages({ ...valid, footerText: at(60) })).toEqual([]);
      expect(messages({ ...valid, footerText: at(61) })).toEqual([
        "footerTooLong",
      ]);
    });

    test("button text: 25 passes, 26 is buttonTextTooLong", () => {
      const quick = (text: string) => [{ type: "QUICK_REPLY" as const, text }];
      expect(messages({ ...valid, buttons: quick(at(25)) })).toEqual([]);
      expect(messages({ ...valid, buttons: quick(at(26)) })).toEqual([
        "buttonTextTooLong",
      ]);
    });

    test("button URL: 2000 passes, 2001 is urlTooLong", () => {
      const url = (n: number) => [
        {
          type: "URL" as const,
          text: "Ver",
          url: `https://essentia.es/${at(n - "https://essentia.es/".length)}`,
        },
      ];
      expect(messages({ ...valid, buttons: url(2000) })).toEqual([]);
      expect(messages({ ...valid, buttons: url(2001) })).toEqual([
        "urlTooLong",
      ]);
    });

    test("examples: 200 characters pass, 201 is exampleTooLong", () => {
      expect(messages({ ...valid, exampleParams: [at(200), "x"] })).toEqual([]);
      expect(messages({ ...valid, exampleParams: [at(201), "x"] })).toEqual([
        "exampleTooLong",
      ]);
    });

    test("examples: 20 pass, 21 is exampleTooLong", () => {
      const body = (n: number) =>
        `a ${Array.from({ length: n }, (_, i) => `{{${i + 1}}}`).join(" b ")} c`;
      const examples = (n: number) => Array.from({ length: n }, () => "x");
      expect(
        messages({ ...valid, body: body(20), exampleParams: examples(20) }),
      ).toEqual([]);
      expect(
        messages({ ...valid, body: body(21), exampleParams: examples(21) }),
      ).toEqual(["exampleTooLong"]);
    });
  });

  describe("shape", () => {
    test("an empty or whitespace-only body is templateBodyRequired", () => {
      expect(messages({ ...valid, body: "", exampleParams: [] })).toContain(
        "templateBodyRequired",
      );
      expect(
        messages({ ...valid, body: "   \n ", exampleParams: [] }, "body"),
      ).toEqual(["templateBodyRequired"]);
    });

    test("the name is trimmed before the format check", () => {
      const result = whatsappTemplateSchema.safeParse({
        ...valid,
        name: "  recordatorio_cita  ",
      });
      expect(result.success && result.data.name).toBe("recordatorio_cita");
    });

    test("an empty header is accepted", () => {
      expect(messages({ ...valid, headerText: "" })).toEqual([]);
    });

    test("a URL button without a url is rejected", () => {
      const buttons = [{ type: "URL" as const, text: "Ver" }];
      expect(messages({ ...valid, buttons }, "buttons.0.url")).not.toEqual([]);
    });

    test("an unknown button type is rejected", () => {
      const buttons = [{ type: "PHONE_NUMBER", text: "Llamar" }];
      expect(messages({ ...valid, buttons }, "buttons.0.type")).not.toEqual([]);
    });

    test("English is accepted", () => {
      expect(messages({ ...valid, language: "en" })).toEqual([]);
    });

    test("a placeholder at the end of the body is paramAtEdge", () => {
      const input = { ...valid, body: "Hola {{1}}, te esperamos el {{2}}" };
      expect(messages(input, "body")).toEqual(["paramAtEdge"]);
    });
  });
});

describe("validateWhatsAppTemplate", () => {
  test("returns the parsed data for a valid input", () => {
    const result = validateWhatsAppTemplate(valid);
    expect(result.ok).toBe(true);
  });

  for (const input of [null, undefined, "x", 42, []]) {
    test(`an input that is not an object (${JSON.stringify(input) ?? "undefined"}) is invalidInput under _`, () => {
      expect(validateWhatsAppTemplate(input)).toEqual({
        ok: false,
        fieldErrors: { _: "invalidInput" },
      });
    });
  }

  test("keeps our keys per field and never leaks Zod's own sentences", () => {
    const result = validateWhatsAppTemplate({
      ...valid,
      name: "Mal",
      body: undefined,
    });
    expect(result).toEqual({
      ok: false,
      fieldErrors: { name: "templateNameFormat", body: "invalidInput" },
    });
  });
});
