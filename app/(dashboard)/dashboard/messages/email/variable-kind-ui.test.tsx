import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import es from "../../../../../messages/es/dashboard.json";
import { MESSAGE_CATALOG } from "@/lib/messages/catalog";
import { VARIABLE_KINDS, variableKind } from "@/lib/messages/variable-kinds";
import { bodyVariableRenderer, KIND_TONE } from "./variable-kind-ui";

describe("how a variable in the body is drawn", () => {
  const draw = bodyVariableRenderer((name) => `«${name}»`);
  const html = (
    name: string,
    from: "content-variable" | "button-variable" = "content-variable",
  ) =>
    renderToStaticMarkup(
      <NextIntlClientProvider locale="es" messages={{ dashboard: es }}>
        {
          draw({
            variable: { name, required: false, valid: true },
            editor: undefined as never,
            from,
          }) as never
        }
      </NextIntlClientProvider>,
    );

  test("with the icon and the tone of its kind, and its name in words", () => {
    const person = html("first_name");
    expect(person).toContain("<svg");
    expect(person).toContain(KIND_TONE.person);
    expect(person).toContain("«first_name»");
    expect(html("time")).toContain(KIND_TONE.time);
    expect(html("cancel_url")).toContain(KIND_TONE.link);
  });
  test("it shows the short name and keeps the long explanation for the tooltip, which is not there until it is asked for", () => {
    const withHint = bodyVariableRenderer(
      () => "Nombre",
      () => "Nombre (completo, como lo recibe el sistema)",
    );
    const out = renderToStaticMarkup(
      <NextIntlClientProvider locale="es" messages={{ dashboard: es }}>
        {
          withHint({
            variable: { name: "first_name", required: false, valid: true },
            editor: undefined as never,
            from: "content-variable",
          }) as never
        }
      </NextIntlClientProvider>,
    );
    expect(out).toContain(">Nombre<");
    expect(out).not.toContain("completo");
    expect(out).not.toContain('role="tooltip"');
    // Smaller than the text around it, on its baseline, so it never breaks a line.
    expect(out).toContain("text-[0.8em]");
    expect(out).toContain("align-baseline");
  });
  test("every variable any message offers is drawn with a kind of its own", () => {
    for (const key of Object.keys(
      MESSAGE_CATALOG,
    ) as (keyof typeof MESSAGE_CATALOG)[]) {
      for (const name of MESSAGE_CATALOG[key].variables) {
        expect(html(name)).toContain(`data-variable="${name}"`);
        expect(html(name)).toContain("<svg");
      }
    }
  });
  test("a button's variable keeps the editor's own look", () => {
    expect(html("first_name", "button-variable")).not.toContain(
      "data-variable",
    );
  });
  test("every kind has a tone, and the tones pair a fill with a text colour", () => {
    for (const kind of VARIABLE_KINDS) {
      expect(KIND_TONE[kind]).toMatch(/^bg-\S+ text-\S+$/);
    }
    expect(variableKind("first_name")).toBe("person");
  });
});
