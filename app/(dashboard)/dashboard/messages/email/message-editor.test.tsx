import { afterAll, describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import es from "../../../../../messages/es/dashboard.json";
import { MESSAGE_CATALOG } from "@/lib/messages/catalog";
import type {
  MessageCatalogEntry,
  MessageDefaultEntry,
  MessageTemplateRowView,
} from "@/lib/messages/types";

// The editor reads the router and calls Server Actions; neither exists here.
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

const { MessageEditor } = await import("./message-editor");

const defaults = (key: MessageEditorKey): MessageDefaultEntry => ({
  key,
  locale: "es",
  subject: "Asunto",
  preheader: "Pre",
  title: "Título",
  doc: { type: "doc", content: [] },
});
type MessageEditorKey = MessageCatalogEntry["key"];

const catalogOf = (key: MessageEditorKey): MessageCatalogEntry => ({
  key,
  variables: [],
  fixed: [],
  canDisable: MESSAGE_CATALOG[key].canDisable,
  whatsappEligible: MESSAGE_CATALOG[key].whatsappEligible,
});

function render(
  key: MessageEditorKey,
  saved: Partial<MessageTemplateRowView> | null,
) {
  return renderToStaticMarkup(
    <NextIntlClientProvider
      locale="es"
      timeZone="Atlantic/Canary"
      messages={{ dashboard: es }}
    >
      <MessageEditor
        messageKey={key}
        locale="es"
        saved={saved as MessageTemplateRowView | null}
        defaults={defaults(key)}
        catalog={catalogOf(key)}
      />
    </NextIntlClientProvider>,
  );
}

describe("the page of the reminder", () => {
  test("has the switch, on, with its explanation and the way to WhatsApp", () => {
    const html = render("booking_reminder", null);
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain(
      "Se envía un recordatorio por correo antes de cada cita.",
    );
    expect(html).toContain(
      'href="/dashboard/campaigns/new?channel=whatsapp&amp;kind=appointment"',
    );
    expect(html).toContain("Para recordatorios por WhatsApp");
  });

  test("the switch is the panel's own row, named by what it does", () => {
    const html = render("booking_reminder", null);
    expect(html).toContain("Enviar el recordatorio por correo");
    expect(html).toContain('aria-describedby="reminder-switch-note"');
    expect(html).toContain('id="reminder-switch-note"');
  });

  test("switched off it says so, in the switch and beside the title, and Reset is offered", () => {
    const html = render("booking_reminder", { enabled: false });
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain("Apagado: no se envía el recordatorio por correo.");
    expect(html).toContain("Apagado");
    expect(html).toContain("Restablecer");
    // A switch alone is not the admin's text.
    expect(html).not.toContain("Personalizado");
  });

  test("the test button and Save are on the page, and the page has no way to close it", () => {
    const html = render("booking_reminder", null);
    expect(html).toContain("Enviarme prueba");
    expect(html).toContain("Guardar");
    expect(html).not.toContain("Cerrar");
  });
});

describe("the page of any other email", () => {
  test("has no switch, and a default one has no Reset", () => {
    const html = render("booking_confirmed", null);
    expect(html).not.toContain('role="switch"');
    expect(html).not.toContain("Restablecer");
    expect(html).toContain("Enviarme prueba");
  });

  test("a saved text offers Reset, and says nothing about being 'custom' beside the title", () => {
    const html = render("booking_confirmed", { enabled: true, subject: "Mío" });
    expect(html).toContain("Restablecer");
    const top = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
    expect(top).not.toContain("Personalizado");
  });
});

describe("the header of a message page", () => {
  const header = (html: string) =>
    html.slice(html.indexOf("<header"), html.indexOf("</header>"));

  test("holds the title and, on the right, the test, Save and Reset; no fixed bar, no back button", () => {
    const html = render("booking_confirmed", { enabled: true, subject: "Mío" });
    const top = header(html);
    expect(top).toContain("Editar");
    expect(top).toContain("Enviarme prueba");
    expect(top).toContain("Guardar");
    expect(top).toContain("Restablecer");
    expect(html).not.toContain("Volver a mensajes");
    expect(html).not.toContain("sticky bottom-0");
    // Nothing of the actions is left below the header.
    expect(html.slice(html.indexOf("</header>"))).not.toContain(
      "Enviarme prueba",
    );
  });

  test("the help line sits under the title, and the test button is described by it", () => {
    const html = render("booking_confirmed", null);
    const top = header(html);
    expect(top).toContain('id="message-test-help"');
    expect(top).toContain('aria-describedby="message-test-help"');
    expect(top).toContain("La prueba se envía solo a tu email");
  });

  test("the title is first, and is where focus goes", () => {
    const top = header(render("booking_confirmed", null));
    expect(top.indexOf('id="message-title"')).toBeLessThan(
      top.indexOf("Enviarme prueba"),
    );
    expect(top).toContain('tabindex="-1"');
  });

  test("the header stacks on a phone and sits side by side from sm", () => {
    const top = header(render("booking_confirmed", null));
    expect(top).toContain("flex-col");
    expect(top).toContain("sm:flex-row");
    expect(top).toContain("sm:justify-between");
  });

  test("a clean default message has nothing to reset and nothing to save", () => {
    const top = header(render("booking_confirmed", null));
    expect(top).not.toContain("Restablecer");
    expect(top).toMatch(/disabled=""[^>]*>[^<]*(<[^>]*>[^<]*)*Guardar/);
  });
});

describe("the language of the message is chosen inside the page", () => {
  const html = render("booking_confirmed", null);
  const top = html.slice(html.indexOf("<header"), html.indexOf("</header>"));

  test("the title carries no language, and there is no 'Default' badge beside it", () => {
    expect(top).toContain("Editar «Reserva confirmada»");
    expect(top).not.toContain("Español");
    expect(top).not.toContain("Inglés");
    expect(top).not.toContain("Por defecto");
    expect(html).not.toContain("Personalizado");
  });

  test("a switch Spanish | English sits above the subject, as the two pages' links, the open one marked", () => {
    const nav = html.slice(html.indexOf("<nav"), html.indexOf("</nav>"));
    expect(nav).toContain(
      'href="/dashboard/messages/email/booking_confirmed/es"',
    );
    expect(nav).toContain(
      'href="/dashboard/messages/email/booking_confirmed/en"',
    );
    expect(nav.match(/aria-current="page"/g)).toHaveLength(1);
    expect(nav.indexOf("Español")).toBeLessThan(nav.indexOf("Inglés"));
    // The open one is the one marked.
    const marked = nav.slice(nav.indexOf('aria-current="page"'));
    expect(marked.slice(0, marked.indexOf("</a>"))).toContain("Español");
    expect(html.indexOf("<nav")).toBeLessThan(
      html.indexOf('id="message-subject"'),
    );
    expect(html).toContain("Idioma");
  });

  test("the reminder, sent in Spanish only, has nothing to choose", () => {
    const reminder = render("booking_reminder", null);
    expect(reminder).not.toContain("<nav");
    expect(reminder).not.toContain("/booking_reminder/en");
  });
});
