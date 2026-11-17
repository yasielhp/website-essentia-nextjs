import { describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import es from "../../../../../messages/es/dashboard.json";
import en from "../../../../../messages/en/dashboard.json";

// Bun's module mocks outlive the file: the whole of what other tests import from
// the router is given, so they do not find an export missing.
mock.module("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  redirect: () => {},
  notFound: () => {},
}));
mock.module("@/actions/message-templates", () => ({
  saveMessageTemplate: async () => ({ ok: true, id: "x" }),
  sendTestMessage: async () => ({ ok: true, to: "x" }),
  previewMessage: async () => ({ ok: false, error: "generic" }),
  resetMessageTemplate: async () => ({ ok: true, removed: true, kept: null }),
}));

const { WhatsAppMessageEditor } = await import("./whatsapp-message-editor");

function render(locale: "es" | "en") {
  return renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      timeZone="Atlantic/Canary"
      messages={{ dashboard: locale === "es" ? es : en }}
    >
      <WhatsAppMessageEditor
        messageKey="booking_confirmed"
        locale="es"
        saved={null}
        templates={[]}
        canTest
      />
    </NextIntlClientProvider>,
  );
}

describe("the page of a message's WhatsApp notice", () => {
  test("says once, under the header and before the form, where reminders are set up, with the link", () => {
    const html = render("es");
    const note = "se configuran en Campañas &gt; Aviso de cita";
    expect(html.split(note)).toHaveLength(2);
    expect(html).toContain('href="/dashboard/campaigns/new"');
    expect(html).toContain("Crear un Aviso de cita");
    expect(html.indexOf(note)).toBeGreaterThan(html.indexOf("</header>"));
    expect(html.indexOf(note)).toBeLessThan(
      html.indexOf("wa-message-template"),
    );
  });

  test("and in English", () => {
    const html = render("en");
    expect(html).toContain("Create an Appointment notice");
    expect(html).toContain('href="/dashboard/campaigns/new"');
  });
});
