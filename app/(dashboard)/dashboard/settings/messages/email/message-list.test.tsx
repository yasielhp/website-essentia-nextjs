import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import es from "../../../../../../messages/es/dashboard.json";
import { MESSAGE_KEYS } from "@/lib/messages/catalog";
import type {
  MessageCatalogEntry,
  MessageTemplateRowView,
} from "@/lib/messages/types";
import { MessageList, openRow } from "./message-list";

const catalog = MESSAGE_KEYS.map((key) => ({
  key,
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

  test("every row is one link to its own page, and one switch: nothing else to press", () => {
    // The table and the cards each carry one switch per row, and no other button.
    expect(html.match(/<button/g)).toHaveLength(ROWS * 2);
    expect(html.match(/role="switch"/g)).toHaveLength(ROWS * 2);
    const links = [
      ...html.matchAll(/href="(\/dashboard\/settings\/messages\/[^"]+)"/g),
    ].map((m) => m[1]);
    expect(links).toContain(
      "/dashboard/settings/messages/email/booking_received/es",
    );
    expect(links).toContain(
      "/dashboard/settings/messages/email/booking_reminder/es",
    );
    expect(links).toContain(
      "/dashboard/settings/messages/whatsapp/booking_confirmed/es",
    );
    // One row per message and channel, and every one opens the message in
    // Spanish: the language is chosen on its page.
    expect(links.every((href) => href.endsWith("/es"))).toBe(true);
    // The table and the cards each carry them: ROWS of each, all different.
    expect(links).toHaveLength(ROWS * 2);
    expect(new Set(links).size).toBe(ROWS);
  });

  test("no test button and no reset: the switch is the only control a row has", () => {
    expect(html).not.toContain("Enviarme prueba");
    expect(html).not.toContain("Restablecer");
    expect(html).not.toContain("Quitar");
  });

  test("each link says which message it is for, with no language", () => {
    expect(html).toContain('aria-label="Editar Reserva recibida"');
    expect(html).toContain(
      'aria-label="Configurar el WhatsApp de Reserva confirmada"',
    );
    expect(html).not.toMatch(/aria-label="[^"]*(Español|Inglés)"/);
  });

  test("the status never says 'Apagado': the switch says it, once", () => {
    const off = render([row({ enabled: false })]);
    expect(off).not.toContain("Apagado");
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
    [...part.matchAll(/href="(\/dashboard\/settings\/messages\/[^"]+)"/g)].map(
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

  test("a card names each fact, since there is no header: type and content", () => {
    expect(cards).toContain("Tipo:");
    expect(cards).toContain("Contenido:");
    // The switch is up by the title, not a fact among the others.
    expect(cards).not.toContain("Activo:");
    expect(cards).not.toContain("Estado:");
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

  test("there is no column of actions: four columns (the first is the switch), and the row is what opens the message", () => {
    expect(html).not.toContain("Acciones");
    expect(table.match(/<th[^>]*scope="col"/g)).toHaveLength(4);
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

  test("each card has its switch and no other button", () => {
    expect(cards.match(/<button/g)).toHaveLength(ROWS);
    expect(cards.match(/role="switch"/g)).toHaveLength(ROWS);
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

describe("the columns: the switch (State), message, type and content", () => {
  const html = render([]);
  const table = html.slice(html.indexOf("<table"), html.indexOf("</table>"));
  const headers = [...table.matchAll(/<th[^>]*scope="col"[^>]*>([^<]*)</g)].map(
    (m) => m[1],
  );

  test("State (the switch) first, then Message, Type and Content, and no Language column", () => {
    expect(headers).toEqual(["Estado", "Mensaje", "Tipo", "Contenido"]);
    expect(table).not.toContain("Idioma");
    expect(table).not.toContain("Español");
    expect(table).not.toContain("Inglés");
  });

  test("each row has the badge of its type, Email or WhatsApp, with an icon", () => {
    const badges = [
      ...table.matchAll(
        /<span class="[^"]*gap-1\.5[^"]*"><span aria-hidden="true"[^>]*><svg[^>]*>.*?<\/svg><\/span>(Email|WhatsApp)<\/span>/g,
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

describe("the colour of the type badge", () => {
  const html = render([]);
  const table = html.slice(html.indexOf("<table"), html.indexOf("</table>"));
  const cards = html.slice(html.indexOf('<ul class="divide-sand-100'));
  const badge = (part: string, label: string) =>
    [
      ...part.matchAll(
        /<span class="([^"]*)"><span aria-hidden="true"[^>]*><svg[^>]*>.*?<\/svg><\/span>(Email|WhatsApp)<\/span>/g,
      ),
    ]
      .filter((m) => m[2] === label)
      .map((m) => m[1]!);

  test("WhatsApp is green and Email is blue, in the table and in the cards, each with its icon and its name", () => {
    for (const part of [table, cards]) {
      const wa = badge(part, "WhatsApp");
      const mail = badge(part, "Email");
      expect(wa).toHaveLength(2);
      expect(mail).toHaveLength(MESSAGE_KEYS.length);
      for (const cls of wa) {
        expect(cls).toContain("bg-green-100");
        expect(cls).toContain("text-green-800");
        expect(cls).not.toContain("text-blue-700");
      }
      for (const cls of mail) {
        expect(cls).toContain("bg-blue-50");
        expect(cls).toContain("text-blue-700");
        expect(cls).not.toContain("text-green-800");
      }
    }
  });
});

describe("the switch of each row", () => {
  const switches = (html: string) =>
    [...html.matchAll(/<button[^>]*role="switch"[^>]*>/g)].map((m) => m[0]);
  const label = (tag: string) => /aria-label="([^"]+)"/.exec(tag)?.[1];
  const checked = (tag: string) => /aria-checked="(true|false)"/.exec(tag)?.[1];
  const tableOf = (html: string) =>
    html.slice(html.indexOf("<table"), html.indexOf("</table>"));

  const REASON = "Configura la plantilla de WhatsApp para poder activarlo.";
  const locked = (tag: string) => /aria-disabled="true"/.test(tag);

  test("with nothing saved, every email row is on; each switch has its own name: message and channel", () => {
    const html = tableOf(render([]));
    const all = switches(html);
    expect(all).toHaveLength(ROWS);
    const email = all.filter((t) => !label(t)?.includes("WhatsApp"));
    expect(email).toHaveLength(MESSAGE_KEYS.length);
    expect(email.every((tag) => checked(tag) === "true")).toBe(true);
    expect(email.some(locked)).toBe(false);
    const names = all.map(label);
    expect(new Set(names).size).toBe(ROWS);
    expect(names).toContain("Activar Reserva recibida, correo");
    expect(names).toContain("Activar Reserva confirmada, correo");
  });

  test("a WhatsApp row that is not set up shows OFF and cannot be pressed, and its name says why", () => {
    const html = tableOf(render([]));
    const wa = switches(html).filter((t) => label(t)?.includes("WhatsApp"));
    expect(wa).toHaveLength(2);
    for (const tag of wa) {
      expect(checked(tag)).toBe("false");
      expect(locked(tag)).toBe(true);
      expect(label(tag)).toContain(REASON);
    }
    expect(wa.map(label)).toContain(
      `Activar Reserva confirmada, WhatsApp. ${REASON}`,
    );
    // Nothing is written to show it: it is how it is drawn.
    expect(html).not.toContain("<dialog");
  });

  test("a template saved in any language enables it, and it shows what is saved: on by default, off if it was switched off", () => {
    const wa = (over: Partial<MessageTemplateRowView>) =>
      row({ key: "booking_paid", channel: "whatsapp", ...over });
    const find = (rows: MessageTemplateRowView[]) =>
      switches(tableOf(render(rows))).find((t) =>
        label(t)?.startsWith("Activar Pago de la reserva confirmado, WhatsApp"),
      )!;
    const on = find([wa({ locale: "es", whatsapp_template_id: "tpl-1" })]);
    expect(locked(on)).toBe(false);
    expect(checked(on)).toBe("true");
    expect(label(on)).toBe("Activar Pago de la reserva confirmado, WhatsApp");
    const off = find([
      wa({ locale: "es", whatsapp_template_id: "tpl-1", enabled: false }),
      wa({ locale: "en", whatsapp_template_id: "tpl-2", enabled: false }),
    ]);
    expect(locked(off)).toBe(false);
    expect(checked(off)).toBe("false");
  });

  test("the configuration removed from a row that was switched off by hand: still off, and locked again", () => {
    const wa = (locale: "es" | "en") =>
      row({
        key: "booking_paid",
        channel: "whatsapp",
        locale,
        enabled: false,
        whatsapp_template_id: null,
      });
    const tag = switches(tableOf(render([wa("es"), wa("en")]))).find((t) =>
      label(t)?.startsWith("Activar Pago de la reserva confirmado, WhatsApp"),
    )!;
    expect(checked(tag)).toBe("false");
    expect(locked(tag)).toBe(true);
  });

  test("the switch is the first column of the table and sits up by the title on a card", () => {
    const html = render([]);
    const table = tableOf(html);
    const firstRow = table.slice(table.indexOf("<tbody"));
    expect(firstRow.indexOf('role="switch"')).toBeLessThan(
      firstRow.indexOf("data-row-link"),
    );
    const cards = html.slice(html.indexOf('<ul class="divide-sand-100'));
    const card = cards.slice(0, cards.indexOf("Tipo:"));
    expect(card).toContain('role="switch"');
    expect(card.indexOf("data-row-link")).toBeGreaterThan(-1);
  });

  test("a row saved off is off, with a single switch for both languages and nothing said in the status", () => {
    const html = tableOf(
      render([
        row({ key: "booking_paid", locale: "es", enabled: false }),
        row({ key: "booking_paid", locale: "en", enabled: false }),
      ]),
    );
    const tag = switches(html).find(
      (t) => label(t) === "Activar Pago de la reserva confirmado, correo",
    )!;
    expect(checked(tag)).toBe("false");
    // Only that row is off.
    expect(
      switches(html).filter((t) => checked(t) === "false" && !locked(t)),
    ).toHaveLength(1);
    expect(html).not.toContain("Apagado");
  });

  test("the languages that disagree (old data): off, naming the language that is off", () => {
    const html = tableOf(
      render([row({ key: "booking_paid", locale: "en", enabled: false })]),
    );
    const tag = switches(html).find(
      (t) => label(t) === "Activar Pago de la reserva confirmado, correo",
    )!;
    expect(checked(tag)).toBe("false");
    expect(html).toContain("Apagado en Inglés");
  });

  test("the reminder has one language: its switch is the same as any other", () => {
    const html = tableOf(
      render([row({ key: "booking_reminder", locale: "es", enabled: false })]),
    );
    const tag = switches(html).find(
      (t) => label(t) === "Activar Recordatorio de la cita, correo",
    )!;
    expect(checked(tag)).toBe("false");
    expect(html).not.toContain("Apagado en");
  });

  test("email and WhatsApp are two switches", () => {
    const html = tableOf(
      render([
        row({
          key: "booking_confirmed",
          channel: "whatsapp",
          locale: "es",
          enabled: false,
          whatsapp_template_id: "tpl-1",
        }),
        row({
          key: "booking_confirmed",
          channel: "whatsapp",
          locale: "en",
          enabled: false,
          whatsapp_template_id: "tpl-2",
        }),
      ]),
    );
    const byName = (n: string) => switches(html).find((t) => label(t) === n)!;
    expect(checked(byName("Activar Reserva confirmada, WhatsApp"))).toBe(
      "false",
    );
    expect(checked(byName("Activar Reserva confirmada, correo"))).toBe("true");
  });

  test("each switch is a button of at least 44 px on a phone, and the question to turn off is not in the page until it is asked", () => {
    const html = render([]);
    for (const tag of switches(html)) expect(tag).toContain("min-h-11");
    expect(html).not.toContain("<dialog");
    expect(html).not.toContain('role="alertdialog"');
  });
});

describe("a click on the switch does not open the row", () => {
  const fake = (inControl: boolean) => {
    let opened = 0;
    const link = { href: "/x", click: () => (opened += 1) };
    const event = {
      target: {
        closest: (selector: string) =>
          inControl && /button|switch/.test(selector) ? {} : null,
      },
      currentTarget: { querySelector: () => link },
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
    };
    return { event: event as never, opened: () => opened };
  };

  test("a click inside the switch is the switch's alone", () => {
    const f = fake(true);
    openRow(f.event);
    expect(f.opened()).toBe(0);
  });

  test("a click anywhere else on the row still opens it", () => {
    const f = fake(false);
    openRow(f.event);
    expect(f.opened()).toBe(1);
  });
});
