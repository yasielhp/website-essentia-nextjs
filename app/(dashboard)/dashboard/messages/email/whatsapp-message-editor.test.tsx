import { afterAll, describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import es from "../../../../../messages/es/dashboard.json";
import en from "../../../../../messages/en/dashboard.json";

const calls: unknown[] = [];

// Bun's module mocks outlive the file and are process-wide: the real modules are
// kept before they are replaced and put back in `afterAll`, and what the router
// really exports is kept (only the hooks that need a mounted app are replaced),
// so this file runs the same alone as in the whole suite.
const realNavigation = await import("next/navigation");
const realActions = await import("@/actions/message-templates");
mock.module("next/navigation", () => ({
  ...realNavigation,
  useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));
mock.module("@/actions/message-templates", () => ({
  ...realActions,
  saveMessageTemplate: async (...args: unknown[]) => {
    calls.push(args);
    return { ok: true, id: "x" };
  },
  sendTestMessage: async () => ({ ok: true, to: "x" }),
  previewMessage: async () => ({ ok: false, error: "generic" }),
  resetMessageTemplate: async () => ({ ok: true, removed: true, kept: null }),
}));
afterAll(() => {
  mock.module("next/navigation", () => realNavigation);
  mock.module("@/actions/message-templates", () => realActions);
});

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
    expect(html).toContain(
      'href="/dashboard/campaigns/new?channel=whatsapp&amp;kind=appointment"',
    );
    expect(html).toContain("Crear un Aviso de cita");
    expect(html.indexOf(note)).toBeGreaterThan(html.indexOf("</header>"));
    expect(html.indexOf(note)).toBeLessThan(
      html.indexOf("wa-message-template"),
    );
  });

  test("and in English", () => {
    const html = render("en");
    expect(html).toContain("Create an Appointment notice");
    expect(html).toContain(
      'href="/dashboard/campaigns/new?channel=whatsapp&amp;kind=appointment"',
    );
  });
});

describe("the state beside the title", () => {
  test("nothing configured says so, since nothing is sent: not 'by default'", () => {
    const html = render("es");
    const top = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
    expect(top).toContain("Sin configurar");
    expect(top).not.toContain("Por defecto");
    expect(render("en")).toContain("Not set up");
  });
});

describe("the explanation of the page", () => {
  test("the five rules are a list, after the line that says when it goes out and before the note on Campaigns", () => {
    const html = render("es");
    const list = html.slice(html.indexOf("<ul"), html.indexOf("</ul>"));
    expect((list.match(/<li>/g) ?? []).length).toBe(5);
    expect(html.indexOf("Se envía cuando")).toBeLessThan(html.indexOf("<ul"));
    expect(html.indexOf("</ul>")).toBeLessThan(
      html.indexOf("Los recordatorios y avisos posteriores"),
    );
  });
});
