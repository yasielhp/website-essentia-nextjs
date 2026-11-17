import { describe, expect, mock, test } from "bun:test";
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
mock.module("next/navigation", () => ({
  useRouter: () => ({ push: () => {} }),
}));
mock.module("@/actions/message-templates", () => ({
  saveMessageTemplate: async (...args: unknown[]) => {
    calls.push(args);
    return { ok: true, id: "x" };
  },
  sendTestMessage: async () => ({ ok: true, to: "x" }),
  previewMessage: async () => ({ ok: false, error: "generic" }),
  resetMessageTemplate: async () => ({ ok: true, removed: true, kept: null }),
}));

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
    expect(html).toContain('href="/dashboard/campaigns/new"');
    expect(html).toContain("Para recordatorios por WhatsApp");
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

  test("a saved text reads as custom and offers Reset", () => {
    const html = render("booking_confirmed", { enabled: true, subject: "Mío" });
    expect(html).toContain("Personalizado");
    expect(html).toContain("Restablecer");
  });
});
