import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import es from "../../../../../messages/es/dashboard.json";
import en from "../../../../../messages/en/dashboard.json";
import { formStateForStart, type FormState } from "./form-state";

process.env.NEXT_PUBLIC_INSFORGE_URL ??= "http://localhost:0";
process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY ??= "test";
const { TemplateStep } = await import("./template-step");

const render = (state: FormState, locale: "es" | "en" = "es") =>
  renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      timeZone="Atlantic/Canary"
      messages={{ dashboard: locale === "es" ? es : en }}
    >
      <TemplateStep state={state} dispatch={() => {}} onDone={() => {}} />
    </NextIntlClientProvider>,
  );

const base = formStateForStart({ channel: "email", kind: "standard" });
const source = readFileSync(join(import.meta.dir, "template-step.tsx"), "utf8");

describe("the starting point is a select, with the cards gone", () => {
  test("a select for the blank page and the templates, and the select of campaigns already written", () => {
    const html = render(base);
    expect(html.match(/role="combobox"/g)).toHaveLength(2);
    expect(html).toContain('id="campaign-start"');
    expect(html).toContain('aria-label="Punto de partida"');
  });

  test("nothing is chosen at first: the select says so, and none of the old cards or their headings are drawn", () => {
    const html = render(base);
    expect(html).toContain("Elige cómo empezar…");
    expect(html).not.toContain("Newsletter mensual");
    expect(html).not.toContain("Sugerida");
    expect(html).not.toContain(es.campaigns.template.blankHint);
  });

  test("in English too", () => {
    expect(render(base, "en")).toContain("Choose how to start…");
  });

  test("the list is not in the page until it is opened", () => {
    expect(render(base)).not.toContain('role="listbox"');
  });

  test("the hint and the campaigns already written are still there", () => {
    const html = render(base);
    expect(html).toContain(es.campaigns.template.hint);
    expect(html).toContain(es.campaigns.template.previous);
  });
});

describe("picking does what pressing a card did", () => {
  test("the blank page (or keeping the text) finishes the step and changes nothing; a template writes its content for the send language, then finishes", () => {
    expect(source).toContain("commitOnArrows={false}");
    expect(source).toContain(
      "value === BLANK_START ? keepAsIs() : applyTemplate(value)",
    );
    // The template writes the content as the card did.
    expect(source).toMatch(
      /type: "SET_CONTENT_ALL"[\s\S]*blocksToDoc\(blocks\)/,
    );
  });

  test("each pick tells the form what it picked, for the folded summary", () => {
    expect(source.match(/onPick\?\.\(/g)?.length).toBe(3);
  });
});

describe("the folded summary of the step", () => {
  const form = readFileSync(join(import.meta.dir, "campaign-form.tsx"), "utf8");

  test("says the name of what was picked, and 'Chosen' when this session did not pick (a saved campaign)", () => {
    expect(form).toContain('value={startName ?? t("template.chosen")}');
    expect(form).toContain("onPick={setStartName}");
    expect(es.campaigns.template.chosen).toBe("Elegido");
  });
});
