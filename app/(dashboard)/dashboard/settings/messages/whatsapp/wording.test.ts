import { describe, expect, test } from "bun:test";
import es from "../../../../../../messages/es/dashboard.json";
import en from "../../../../../../messages/en/dashboard.json";

/**
 * One word for what Meta calls a template's parameters: «dato variable» / "variable
 * value", the one the campaign form already used. No «parámetro» is left in the
 * texts the admin reads about WhatsApp templates.
 */
function texts(node: unknown): string[] {
  if (typeof node === "string") return [node];
  return Object.values(node as Record<string, unknown>).flatMap(texts);
}

describe("the word for a template's variable values", () => {
  test("the table, the example fields and the counter say it the same way", () => {
    expect(es.messages.whatsapp.table.params).toBe("Datos variables");
    expect(en.messages.whatsapp.table.params).toBe("Variable values");
    expect(es.messages.whatsapp.form.exampleN).toBe("Ejemplo para el dato {n}");
    expect(en.messages.whatsapp.form.exampleN).toBe("Example for value {n}");
    expect(es.messages.whatsapp.paramCount).toContain("dato variable");
    expect(en.messages.whatsapp.paramCount).toContain("variable value");
  });
  test("no text about the templates still says 'parámetro' or 'parameter'", () => {
    for (const node of [es.messages.whatsapp, es.campaigns.form.whatsapp]) {
      expect(texts(node).filter((t) => /par[aá]metro/i.test(t))).toEqual([]);
    }
    for (const node of [en.messages.whatsapp, en.campaigns.form.whatsapp]) {
      expect(texts(node).filter((t) => /parameter/i.test(t))).toEqual([]);
    }
  });
});
