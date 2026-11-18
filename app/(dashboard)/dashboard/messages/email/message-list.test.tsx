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

describe("the list on a phone and on a wide screen", () => {
  const html = render([row({ enabled: false })]);
  const table = html.slice(html.indexOf("<table"), html.indexOf("</table>"));
  const cards = html.slice(html.indexOf('<ul class="divide-sand-100'));

  const hrefs = (part: string) =>
    [...part.matchAll(/href="(\/dashboard\/messages\/[^"]+)"/g)].map(
      (m) => m[1],
    );
  const names = (part: string) =>
    [...part.matchAll(/aria-label="([^"]+)"/g)].map((m) => m[1]);

  test("the table is for wide screens and the cards for narrow ones", () => {
    expect(html).toContain('class="hidden md:block"');
    expect(
      cards.startsWith('<ul class="divide-sand-100 divide-y md:hidden"'),
    ).toBe(true);
  });

  test("both show the same links, in the same order, each with a name of its own", () => {
    expect(hrefs(cards)).toEqual(hrefs(table));
    expect(hrefs(cards).length).toBeGreaterThan(10);
    expect(names(cards)).toEqual(names(table));
    expect(new Set(names(cards)).size).toBe(names(cards).length);
  });

  test("a card names each fact, since there is no header: language and state", () => {
    expect(cards).toContain("Idioma:");
    expect(cards).toContain("Estado:");
    expect(table).not.toContain("Idioma:");
  });

  test("a card's link is its title, at least 44 px tall, and the whole card opens it", () => {
    const links = [...cards.matchAll(/<a [^>]*>/g)].map((m) => m[0]);
    expect(links.length).toBeGreaterThan(10);
    for (const link of links) {
      expect(link).toContain("min-h-11");
      expect(link).toContain("data-row-link");
    }
    const items = [...cards.matchAll(/<li class="([^"]*)"/g)].map((m) => m[1]);
    expect(items.length).toBe(links.length);
    for (const cls of items) expect(cls).toContain("cursor-pointer");
  });

  test("there is no column of actions: three columns, and the row is what opens the message", () => {
    expect(html).not.toContain("Acciones");
    expect(table.match(/<th[^>]*scope="col"/g)).toHaveLength(3);
    const rows = [...table.matchAll(/<tr [^>]*class="([^"]*)"/g)]
      .map((m) => m[1])
      .filter((cls) => cls.includes("align-top"));
    expect(rows.length).toBeGreaterThan(10);
    for (const cls of rows) expect(cls).toContain("cursor-pointer");
    // No button-shaped link is left: nothing reads "Editar" or "Configurar" on its own.
    expect(html).not.toMatch(/>Editar</);
    expect(html).not.toMatch(/>Configurar</);
  });

  test("the name of each message is its link, one per row, and the WhatsApp tag stays out of it", () => {
    const link = (part: string, label: string) =>
      part.match(
        new RegExp(`<a [^>]*aria-label="${label}"[^>]*>([^<]*)</a>`),
      )?.[1];
    for (const part of [table, cards]) {
      expect(link(part, "Editar Reserva recibida, Español")).toBe(
        "Reserva recibida",
      );
      expect(
        link(part, "Configurar el WhatsApp de Reserva confirmada, Español"),
      ).toBe("Reserva confirmada");
    }
    expect(table.match(/data-row-link/g)).toHaveLength(
      table.match(/align-top/g)!.length,
    );
    expect(html).toContain("· WhatsApp");
  });

  test("the cards have no buttons or switches either", () => {
    expect(cards).not.toContain("<button");
    expect(cards).not.toContain('role="switch"');
  });

  test("the switched-off reminder shows its badge in both", () => {
    expect(table).toContain("Apagado");
    expect(cards).toContain("Apagado");
  });

  test("the long state of a WhatsApp row can wrap", () => {
    const wa = cards.slice(cards.indexOf("Sin configurar"));
    expect(wa.slice(0, 5)).toBe("Sin c");
    const pill = cards.slice(
      cards.lastIndexOf("<span", cards.indexOf("Sin configurar")),
      cards.indexOf("Sin configurar"),
    );
    expect(pill).not.toContain("whitespace-nowrap");
  });
});

describe("the list says nothing about where reminders are set up", () => {
  const html = render([]);
  test("no note after the WhatsApp rows, in the table or in the cards", () => {
    expect(html).not.toContain("Crear un Aviso de cita");
    expect(html).not.toContain("Aviso de cita");
    expect(html).not.toContain('href="/dashboard/campaigns/new"');
  });
});
