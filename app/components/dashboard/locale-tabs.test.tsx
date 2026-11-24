import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleTabs } from "./locale-tabs";

const NAMES = { es: "Español", en: "Inglés" } as const;

const render = (
  props: Partial<Parameters<typeof LocaleTabs<"es" | "en">>[0]> = {},
) =>
  renderToStaticMarkup(
    <LocaleTabs
      id="campaign-language"
      label="Idioma"
      locales={["es", "en"]}
      active="es"
      onChange={() => {}}
      nameOf={(locale) => NAMES[locale]}
      incompleteText="incompleto"
      {...props}
    />,
  );

describe("LocaleTabs", () => {
  test("two languages are two choices, Spanish first, the one on screen checked", () => {
    const html = render();
    expect(html).toContain('role="radiogroup"');
    expect(html.match(/role="radio"/g)).toHaveLength(2);
    expect(html.indexOf("Español")).toBeLessThan(html.indexOf("Inglés"));
    expect(html).toMatch(/id="campaign-language-es"[^>]*aria-checked="true"/);
    expect(html).toMatch(/id="campaign-language-en"[^>]*aria-checked="false"/);
  });

  test("the group is named by its label", () => {
    const html = render();
    expect(html).toContain('id="campaign-language-label"');
    expect(html).toContain('aria-labelledby="campaign-language-label"');
    expect(html).toContain("Idioma");
  });

  test("one language is no choice: nothing is drawn", () => {
    expect(render({ locales: ["es"] })).toBe("");
  });

  test("a version with something missing carries a mark, and says so in words", () => {
    const html = render({ incomplete: ["en"] });
    expect(html).toContain('data-incomplete="en"');
    expect(html).not.toContain('data-incomplete="es"');
    expect(html).toContain("incompleto");
  });

  test("with nothing missing there is no mark", () => {
    const html = render({ incomplete: [] });
    expect(html).not.toContain("data-incomplete");
    expect(html).not.toContain("incompleto");
  });

  test("only the checked one is in the tab order: the arrows move between them", () => {
    const html = render({ active: "en" });
    expect(html).toMatch(/id="campaign-language-en"[^>]*tabindex="0"/);
    expect(html).toMatch(/id="campaign-language-es"[^>]*tabindex="-1"/);
  });

  test("it can be switched off while the form is busy", () => {
    expect(render({ disabled: true }).match(/disabled=""/g)).toHaveLength(2);
  });
});
