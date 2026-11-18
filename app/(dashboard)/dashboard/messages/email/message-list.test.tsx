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

/** One row per message, and one more for each of the two that also go out on WhatsApp. */
const ROWS = MESSAGE_KEYS.length + 2;

describe("the list of messages", () => {
  const html = render([]);

  test("every row is one link to its own page, and nothing else to press", () => {
    expect(html).not.toContain("<button");
    const links = [
      ...html.matchAll(/href="(\/dashboard\/messages\/[^"]+)"/g),
    ].map((m) => m[1]);
    expect(links).toContain("/dashboard/messages/email/booking_received/es");
    expect(links).toContain("/dashboard/messages/email/booking_reminder/es");
    expect(links).toContain(
      "/dashboard/messages/whatsapp/booking_confirmed/es",
    );
    // One row per message and channel, and every one opens the message in
    // Spanish: the language is chosen on its page.
    expect(links.every((href) => href.endsWith("/es"))).toBe(true);
    // The table and the cards each carry them: ROWS of each, all different.
    expect(links).toHaveLength(ROWS * 2);
    expect(new Set(links).size).toBe(ROWS);
  });

  test("no test button, no reset, no switch", () => {
    expect(html).not.toContain("Enviarme prueba");
    expect(html).not.toContain("Restablecer");
    expect(html).not.toContain('role="switch"');
    expect(html).not.toContain("Quitar");
  });

  test("each link says which message it is for, with no language", () => {
    expect(html).toContain('aria-label="Editar Reserva recibida"');
    expect(html).toContain(
      'aria-label="Configurar el WhatsApp de Reserva confirmada"',
    );
    expect(html).not.toMatch(/aria-label="[^"]*(Español|Inglés)"/);
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
    expect(hrefs(cards)).toHaveLength(ROWS);
    expect(names(cards)).toEqual(names(table));
    expect(new Set(names(cards)).size).toBe(names(cards).length);
  });

  test("a card names each fact, since there is no header: type and state", () => {
    expect(cards).toContain("Tipo:");
    expect(cards).toContain("Estado:");
    expect(cards).not.toContain("Idioma");
    expect(table).not.toContain("Tipo:");
  });

  test("a card's link is its title, at least 44 px tall, and the whole card opens it", () => {
    const links = [...cards.matchAll(/<a [^>]*>/g)].map((m) => m[0]);
    expect(links).toHaveLength(ROWS);
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
    expect(rows).toHaveLength(ROWS);
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
      expect(link(part, "Editar Reserva recibida")).toBe("Reserva recibida");
      expect(link(part, "Configurar el WhatsApp de Reserva confirmada")).toBe(
        "Reserva confirmada",
      );
    }
    expect(table.match(/data-row-link/g)).toHaveLength(
      table.match(/align-top/g)!.length,
    );
    // The channel is the Type column's, not an addition to the name.
    expect(html).not.toContain("· WhatsApp");
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

describe("the columns: message, type and state", () => {
  const html = render([]);
  const table = html.slice(html.indexOf("<table"), html.indexOf("</table>"));
  const headers = [...table.matchAll(/<th[^>]*scope="col"[^>]*>([^<]*)</g)].map(
    (m) => m[1],
  );

  test("Message, Type and State, and no Language column", () => {
    expect(headers).toEqual(["Mensaje", "Tipo", "Estado"]);
    expect(table).not.toContain("Idioma");
    expect(table).not.toContain("Español");
    expect(table).not.toContain("Inglés");
  });

  test("each row has the badge of its type, Email or WhatsApp, with an icon", () => {
    const badges = [
      ...table.matchAll(
        /<span class="[^"]*bg-sand-100[^"]*gap-1\.5[^"]*"><span aria-hidden="true"[^>]*><svg[^>]*>.*?<\/svg><\/span>(Email|WhatsApp)<\/span>/g,
      ),
    ].map((m) => m[1]);
    expect(badges.filter((b) => b === "Email")).toHaveLength(
      MESSAGE_KEYS.length,
    );
    expect(badges.filter((b) => b === "WhatsApp")).toHaveLength(2);
  });

  test("the same message appears once as Email and once as WhatsApp, with the same name", () => {
    expect(table.match(/>Reserva confirmada<\/a>/g)).toHaveLength(2);
    expect(table.match(/>Reserva recibida<\/a>/g)).toHaveLength(1);
  });
});

describe("the state of a message, summed over its languages", () => {
  const text = (rows: MessageTemplateRowView[]) => {
    const html = render(rows);
    return html.slice(html.indexOf("<table"), html.indexOf("</table>"));
  };

  test("only Spanish edited: customised, naming Spanish", () => {
    const t = text([
      row({ key: "booking_received", locale: "es", subject: "Hola" }),
    ]);
    expect(t).toContain("Personalizado: Español");
  });
  test("only English edited: naming English", () => {
    expect(
      text([row({ key: "booking_received", locale: "en", subject: "Hi" })]),
    ).toContain("Personalizado: Inglés");
  });
  test("both edited: just customised", () => {
    const t = text([
      row({ key: "booking_received", locale: "es", subject: "Hola" }),
      row({ key: "booking_received", locale: "en", subject: "Hi" }),
    ]);
    expect(t).toContain(">Personalizado<");
    expect(t).not.toContain("Personalizado: ");
  });
  test("the reminder, sent in Spanish only, is customised when its Spanish is", () => {
    expect(text([row({ key: "booking_reminder", subject: "Hola" })])).toContain(
      ">Personalizado<",
    );
  });
  test("an unreadable text says in which language, in red", () => {
    const t = text([
      row({ key: "booking_cancelled", locale: "en", corrupt: true }),
    ]);
    expect(t).toContain("Dañado: Inglés");
    expect(t).toContain("bg-red-100");
  });
  test("a WhatsApp message with nothing set up says nothing is sent, once", () => {
    const t = text([]);
    expect(t.match(/Sin configurar: no se envía nada/g)).toHaveLength(2);
  });
  test("the save shown is the most recent one, and who made it", () => {
    const t = text([
      row({
        key: "booking_received",
        locale: "es",
        subject: "Hola",
        updated_at: "2026-11-10T10:00:00Z",
        updated_by_name: "Ana",
      }),
      row({
        key: "booking_received",
        locale: "en",
        subject: "Hi",
        updated_at: "2026-11-16T10:00:00Z",
        updated_by_name: "Luis",
      }),
    ]);
    expect(t).toContain("por Luis");
    expect(t).not.toContain("por Ana");
  });
});
