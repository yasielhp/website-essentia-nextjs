import { afterAll, describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import es from "../../../../../../messages/es/dashboard.json";
import en from "../../../../../../messages/en/dashboard.json";
import type { WhatsAppTemplateRow } from "@/lib/whatsapp/types";

// The form is a page now and asks before a link leaves it (`useUnsavedGuard`),
// which needs the app router. Bun's module mocks are process-wide: what the
// router really exports is kept, only the hooks that need a mounted app are
// replaced, and the real module is put back in `afterAll`.
const realNavigation = await import("next/navigation");
mock.module("next/navigation", () => ({
  ...realNavigation,
  useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));
afterAll(() => {
  mock.module("next/navigation", () => realNavigation);
});
const { TemplateForm } = await import("./template-form");

const wrap = (locale: "es" | "en", seed: WhatsAppTemplateRow | null = null) =>
  renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      timeZone="Atlantic/Canary"
      messages={{ dashboard: locale === "es" ? es : en }}
    >
      <TemplateForm
        seed={seed}
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

describe("the quick-reply button that should unsubscribe", () => {
  const seed = (text: string) =>
    ({
      name: "aviso",
      language: "es",
      category: "MARKETING",
      body: "Hola",
      header_text: null,
      footer_text: null,
      example_params: [],
      buttons: [{ type: "QUICK_REPLY", text }],
    }) as unknown as WhatsAppTemplateRow;
  const explanation =
    "Para que un botón dé de baja a la clienta, su texto debe ser exactamente BAJA (o STOP en inglés).";

  test("a quick-reply button always carries the explanation", () => {
    const html = wrap("es", seed("Confirmar"));
    expect(html).toContain(explanation);
    expect(html).toContain('id="wa-button-0-optout"');
    expect(html).not.toContain('role="status"');
  });
  test("one that talks about leaving without being the exact word says it as a warning", () => {
    const html = wrap("es", seed("Darme de baja"));
    expect(html).toContain('role="status"');
    expect(html).toContain("text-yellow-800");
  });
  test("the exact word is not warned about", () => {
    expect(wrap("es", seed("BAJA"))).not.toContain('role="status"');
  });
  test("the English text", () => {
    expect(en.messages.whatsapp.help.optOutButton).toBe(
      "For a button to unsubscribe the client, its text must be exactly STOP (or BAJA in Spanish).",
    );
  });
});
