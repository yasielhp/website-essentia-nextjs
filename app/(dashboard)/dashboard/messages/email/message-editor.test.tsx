import { afterAll, describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import es from "../../../../../messages/es/dashboard.json";
import { defaultContent } from "@/emails/defaults";
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
  doc: defaultContent(key, "es").doc,
});
type MessageEditorKey = MessageCatalogEntry["key"];

const catalogOf = (key: MessageEditorKey): MessageCatalogEntry => ({
  key,
  variables: [...MESSAGE_CATALOG[key].variables],
  fixed: [...MESSAGE_CATALOG[key].fixed],
  afterClosing: [...MESSAGE_CATALOG[key].afterClosing],
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

  test("what the test sends describes its button for a screen reader, and is not a line under the title", () => {
    const html = render("booking_confirmed", null);
    const top = header(html);
    expect(top).toContain('aria-describedby="message-test-help"');
    const help = top.match(/<p[^>]*id="message-test-help"[^>]*>/)?.[0] ?? "";
    expect(help).toContain('class="sr-only"');
    expect(top).toContain("La prueba se envía solo a tu email");
  });

  test("a message nobody has edited says nothing about whose text it is", () => {
    const html = render("booking_confirmed", null);
    expect(html).not.toContain("Estás viendo el texto actual del correo");
    expect(html).not.toContain('id="message-notice"');
    expect(header(html)).not.toContain('aria-describedby="message-notice"');
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

describe("the whole email in one editor", () => {
  const confirmed = render("booking_confirmed", null);
  const top = confirmed.slice(0, confirmed.indexOf('id="message-body-label"'));

  test("above the editor there are only the language, the subject and the preheader: no Title field, no list of variables", () => {
    expect(top).toContain('id="message-subject"');
    expect(top).toContain('id="message-preheader"');
    expect(top).not.toContain('id="message-title"[^>]*type="text"');
    expect(top).not.toContain("El encabezado grande dentro del correo");
    expect(confirmed).not.toContain('id="message-variables"');
    expect(confirmed).not.toContain("Pulsa una para insertarla");
    // One field called Title is gone; the title is inside the body.
    expect(top).not.toMatch(/<label[^>]*>Título<\/label>/);
  });

  test("the bar of variables is inside the body's card, first, and the editor follows it", () => {
    const body = confirmed.slice(confirmed.indexOf('id="message-body-label"'));
    expect(body.indexOf('role="toolbar"')).toBeGreaterThan(-1);
    expect(body.indexOf('role="toolbar"')).toBeLessThan(
      body.indexOf('role="group"'),
    );
    expect(confirmed).not.toContain("Bloques del sistema de este correo");
    expect(confirmed).not.toContain("Lo añade el sistema; no se edita");
  });

  test("the bar is one stop for the keyboard, with a name on each chip", () => {
    const bar = confirmed.slice(confirmed.indexOf('role="toolbar"'));
    const buttons = [
      ...bar
        .slice(0, bar.indexOf("</div></div>"))
        .matchAll(/<button[^>]*tabindex="(-?\d)"[^>]*>/g),
    ];
    expect(buttons.length).toBe(
      MESSAGE_CATALOG.booking_confirmed.variables.length,
    );
    expect(buttons.filter((m) => m[1] === "0")).toHaveLength(1);
    expect(bar).toContain('aria-orientation="horizontal"');
    expect(bar).toContain('aria-label="Variables"');
  });

  test("it slides sideways on a phone, and the chips are 44 px high", () => {
    const bar = confirmed.slice(confirmed.indexOf('role="toolbar"'));
    expect(bar.slice(0, 400)).toContain("overflow-x-auto");
    expect(bar).toContain("min-h-11");
    expect(confirmed).toContain("sticky top-0");
  });

  test("every chip has its icon and the tone of its kind", () => {
    const bar = confirmed.slice(confirmed.indexOf('role="toolbar"'));
    const chips = bar.slice(0, bar.indexOf("</div></div>"));
    for (const b of chips.split("<button").slice(1))
      expect(b).toContain("<svg");
    expect(chips).toContain("text-purple-700");
    expect(chips).toContain("text-blue-700");
    expect(chips).toContain("text-teal-700");
  });

  test("with every block in the document there is nothing to add back", () => {
    // The default document has them all: the menu appears only for what is missing.
    expect(confirmed).not.toContain("Añadir bloque");
  });

  test("a hint says the order here is the order of the email", () => {
    expect(confirmed).toContain("Aquí está todo el correo, de arriba abajo");
    expect(confirmed).toContain('aria-describedby="message-body-hint"');
  });

  test("the old lines of help that no longer hold are gone", () => {
    expect(confirmed).not.toContain("el texto de cierre por defecto");
    expect(confirmed).not.toContain("Dejar el cuerpo vacío");
  });
});

describe("the editor's nodes for the email", () => {
  test("a title, the blocks, and the guard that keeps them in order", async () => {
    const { emailNodeExtensions } = await import("./email-node-views");
    const nodes = emailNodeExtensions({
      variables: [],
      titleLabel: "Título",
      blockName: () => "",
      blockWhat: () => "",
      variableLabel: (n) => n,
      up: () => "",
      down: () => "",
      remove: () => "",
      drag: () => "",
    });
    expect(nodes.map((n) => n.name)).toEqual([
      "emailTitle",
      "systemBlock",
      "emailDocGuard",
    ]);
  });
});

describe("a block the email must carry and the document lacks", () => {
  /** The default document without one kind of block, as a saved row. */
  const without = (key: Parameters<typeof render>[0], kind: string) => ({
    enabled: true,
    doc: {
      type: "doc",
      content: (defaultContent(key, "es").doc.content ?? []).filter(
        (n) => !(n.type === "systemBlock" && n.attrs?.kind === kind),
      ),
    },
  });
  const header = (html: string) =>
    html.slice(html.indexOf("<header"), html.indexOf("</header>"));

  test("it is an alert over the editor that names it, with a button to add it", () => {
    const html = render(
      "booking_confirmed",
      without("booking_confirmed", "cancel_link") as never,
    );
    const alert = html.slice(html.indexOf('id="message-missing-blocks"'));
    expect(alert).toContain('role="alert"');
    expect(alert.slice(0, alert.indexOf("</div></div>"))).toContain(
      "Falta «Enlace para cancelar o cambiar la cita». Este correo debe llevarlo.",
    );
    expect(alert.slice(0, 900)).toContain(">Añadir<");
    expect(html.indexOf('id="message-missing-blocks"')).toBeLessThan(
      html.indexOf('role="toolbar"'),
    );
  });

  test("one line for each that is missing", () => {
    const html = render("booking_confirmed", {
      enabled: true,
      doc: {
        type: "doc",
        content: [defaultContent("booking_confirmed", "es").doc.content![0]],
      },
    } as never);
    const alert = html.slice(
      html.indexOf('id="message-missing-blocks"'),
      html.indexOf('role="toolbar"'),
    );
    expect((alert.match(/Este correo debe llevarlo/g) ?? []).length).toBe(2);
    expect(alert).toContain("Botón para firmar el consentimiento");
    expect(alert).toContain("Enlace para cancelar o cambiar la cita");
  });

  test("Save waits, and says why", () => {
    const top = header(
      render(
        "booking_confirmed",
        without("booking_confirmed", "cancel_link") as never,
      ),
    );
    expect(top).toMatch(/disabled=""[^>]*>[^<]*(<[^>]*>[^<]*)*Guardar/);
    expect(top).toContain("Falta un bloque que este correo debe llevar");
    expect(top).toContain('aria-describedby="message-missing-blocks"');
  });

  test("a block that only informs may be missing without a word", () => {
    const html = render(
      "booking_confirmed",
      without("booking_confirmed", "location") as never,
    );
    expect(html).not.toContain('id="message-missing-blocks"');
    expect(html).not.toContain("Este correo debe llevarlo");
    // It can be put back from the bar.
    expect(html).toContain("Añadir bloque");
  });

  test("with nothing missing there is no alert, and no lock anywhere", () => {
    const html = render("booking_confirmed", null);
    expect(html).not.toContain('id="message-missing-blocks"');
    expect(html).not.toContain("No se puede quitar");
  });
});
