import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import es from "../../../../../messages/es/dashboard.json";
import en from "../../../../../messages/en/dashboard.json";
import { TemplateForm } from "./template-form";

const wrap = (locale: "es" | "en") =>
  renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      timeZone="Atlantic/Canary"
      messages={{ dashboard: locale === "es" ? es : en }}
    >
      <TemplateForm
        seed={null}
        configured
        takenNames={[]}
        onClose={() => {}}
        onCreated={() => {}}
      />
    </NextIntlClientProvider>,
  );

describe("the template form", () => {
  test("opens with Cancel and the send button, and no question", () => {
    const html = wrap("es");
    expect(html).toContain('id="template-cancel-button"');
    expect(html).not.toContain("¿Descartar la plantilla sin enviarla?");
  });
  test("the question exists in both languages for when something was written", () => {
    expect(es.messages.whatsapp.form.discardConfirm).toBe(
      "¿Descartar la plantilla sin enviarla?",
    );
    expect(en.messages.whatsapp.form.discardConfirm).toBe(
      "Discard this template without submitting it?",
    );
    for (const key of ["discardKeep", "discardYes"] as const) {
      expect(es.messages.whatsapp.form[key]).toBeTruthy();
      expect(en.messages.whatsapp.form[key]).toBeTruthy();
    }
  });
});
