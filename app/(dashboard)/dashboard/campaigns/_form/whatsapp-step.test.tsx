import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import es from "../../../../../messages/es/dashboard.json";
import en from "../../../../../messages/en/dashboard.json";
import { formStateForStart } from "./form-state";
import { WhatsAppStep } from "./whatsapp-step";
import type { TemplatesState } from "./use-whatsapp-templates";

const state = formStateForStart({ channel: "whatsapp", kind: "standard" });

function render(templates: TemplatesState, locale: "es" | "en" = "es") {
  return renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      timeZone="Atlantic/Canary"
      messages={{ dashboard: locale === "es" ? es : en }}
    >
      <WhatsAppStep
        state={state}
        dispatch={() => {}}
        templates={templates}
        onRetryTemplates={() => {}}
        onDone={() => {}}
      />
    </NextIntlClientProvider>,
  );
}

describe("when the templates could not be loaded", () => {
  const html = render({ status: "error", error: "db" });
  test("says so and offers to try again, without a reload that would lose the campaign", () => {
    expect(html).toContain("No se pudieron cargar las plantillas.");
    expect(html).not.toContain("Recarga la página");
    expect(html).toContain("Reintentar");
    expect(render({ status: "error", error: "db" }, "en")).toContain(
      "The templates could not be loaded.",
    );
  });
});

describe("when there is no template to use", () => {
  const html = render({ status: "ready", templates: [], configured: true });
  test("the link to create one opens in another tab, safely, so the campaign is not lost", () => {
    const link =
      html.match(
        /<a [^>]*href="\/dashboard\/settings\/messages\?tab=whatsapp"[^>]*>/,
      )?.[0] ?? "";
    expect(link).toContain('target="_blank"');
    expect(link).toContain("noopener");
  });
});
