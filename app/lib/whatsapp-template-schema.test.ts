import { describe, expect, test } from "bun:test";
import { whatsappTemplateSchema } from "@/lib/schemas";

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
});
