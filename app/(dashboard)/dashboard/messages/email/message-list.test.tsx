import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import es from "../../../../../messages/es/dashboard.json";
import { MESSAGE_CATALOG, MESSAGE_KEYS } from "@/lib/messages/catalog";
import type {
  MessageCatalogEntry,
  MessageTemplateRowView,
} from "@/lib/messages/types";
import { MessageList } from "./message-list";

const catalog = MESSAGE_KEYS.map((key) => ({
  key,
  canDisable: MESSAGE_CATALOG[key].canDisable,
})) as unknown as MessageCatalogEntry[];

const row = (over: Partial<MessageTemplateRowView>): MessageTemplateRowView =>
  ({
    id: "r",
    key: "booking_reminder",
    channel: "email",
    locale: "es",
    enabled: true,
    subject: null,
    preheader: null,
    title: null,
    doc: null,
    corrupt: false,
    updated_at: null,
    updated_by_name: null,
    ...over,
  }) as unknown as MessageTemplateRowView;

function render(rows: MessageTemplateRowView[]): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider
      locale="es"
      timeZone="Atlantic/Canary"
      messages={{ dashboard: es }}
    >
      <MessageList rows={rows} catalog={catalog} templates={[]} />
    </NextIntlClientProvider>,
  );
}

describe("the list of messages", () => {
  const html = render([]);

  test("every row is one link to its own page, and nothing else to press", () => {
    expect(html).not.toContain("<button");
    const links = [
      ...html.matchAll(/href="(\/dashboard\/messages\/[^"]+)"/g),
    ].map((m) => m[1]);
    expect(links).toContain("/dashboard/messages/email/booking_received/es");
    expect(links).toContain("/dashboard/messages/email/booking_reminder/es");
    expect(links).not.toContain(
      "/dashboard/messages/email/booking_reminder/en",
    );
    expect(links).toContain(
      "/dashboard/messages/whatsapp/booking_confirmed/en",
    );
  });

  test("no test button, no reset, no switch", () => {
    expect(html).not.toContain("Enviarme prueba");
    expect(html).not.toContain("Restablecer");
    expect(html).not.toContain('role="switch"');
    expect(html).not.toContain("Quitar");
  });

  test("each link says which message and which language it is for", () => {
    expect(html).toContain('aria-label="Editar Reserva recibida, Español"');
    expect(html).toContain('aria-label="Editar Reserva recibida, Inglés"');
    expect(html).toContain(
      'aria-label="Configurar el WhatsApp de Reserva confirmada, Español"',
    );
  });

  test("a switched-off reminder shows the badge, with no switch to flip it", () => {
    const off = render([row({ enabled: false })]);
    expect(off).toContain("Apagado");
    expect(off).not.toContain('role="switch"');
    expect(off).not.toContain("<button");
    expect(html).not.toContain("Apagado");
  });

  test("a custom text and a default one read as such", () => {
    const custom = render([
      row({
        key: "booking_received",
        subject: "Hola",
        updated_at: "2026-11-17T10:00:00Z",
      }),
    ]);
    expect(custom).toContain("Personalizado");
    expect(html).toContain("Por defecto");
  });

  test("a row that holds only the switch is still the default, not custom", () => {
    expect(render([row({ enabled: true })])).not.toContain("Personalizado");
  });
});
