import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import es from "../../../../messages/es/dashboard.json";
import en from "../../../../messages/en/dashboard.json";
import {
  AutomaticMessagesSettings,
  WhatsAppTemplatesSettings,
} from "./messages-cards";

const render = (node: React.ReactNode, locale: "es" | "en" = "es") =>
  renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      messages={{ dashboard: locale === "es" ? es : en }}
    >
      {node}
    </NextIntlClientProvider>,
  );

describe("the two cards of Messages in Settings", () => {
  test("each has its own heading like the other cards (a second-level heading in a row of the same height)", () => {
    const email = render(<AutomaticMessagesSettings />);
    expect(email).toContain("<h2");
    expect(email).toContain("h-10");
    expect(email).toContain(">Mensajes automáticos<");
    const whatsapp = render(<WhatsAppTemplatesSettings />);
    expect(whatsapp).toContain("<h2");
    expect(whatsapp).toContain(">Plantillas de WhatsApp<");
  });

  test("and in English", () => {
    expect(render(<AutomaticMessagesSettings />, "en")).toContain(
      ">Automatic messages<",
    );
    expect(render(<WhatsAppTemplatesSettings />, "en")).toContain(
      ">WhatsApp templates<",
    );
  });

  test("nothing is read until the card is near the screen: what is drawn first is the content's own loading shape", () => {
    const email = render(<AutomaticMessagesSettings />);
    // The intro, and the list's skeleton (busy), not the list.
    expect(email).toContain("Los correos que el sistema envía automáticamente");
    expect(email).toContain('aria-busy="true"');
    expect(email).not.toContain('role="switch"');
    const whatsapp = render(<WhatsAppTemplatesSettings />);
    expect(whatsapp).not.toContain("Nueva plantilla");
    expect(whatsapp).not.toContain("<dialog");
  });

  test("the WhatsApp card keeps a place at the right of its heading for the New template button", () => {
    const html = render(<WhatsAppTemplatesSettings />);
    expect(html).toMatch(
      /<div class="[^"]*justify-between[^"]*"><h2[^>]*>Plantillas de WhatsApp<\/h2><div class="[^"]*shrink-0[^"]*"><\/div><\/div>/,
    );
  });

  test("there are no tabs and no page header of its own left in the cards", () => {
    for (const html of [
      render(<AutomaticMessagesSettings />),
      render(<WhatsAppTemplatesSettings />),
    ]) {
      expect(html).not.toContain('role="tablist"');
      expect(html).not.toContain('role="tab"');
      expect(html).not.toContain("<h1");
    }
  });
});

describe("the cards in the settings page", () => {
  const sections = readFileSync(
    join(import.meta.dir, "settings-sections.tsx"),
    "utf8",
  );

  test("they come after the four that were there, in this order, each with the id the rest of the dashboard links to", () => {
    const order = [
      "bookings",
      "bonuses",
      "subscriptions",
      "payments",
      "messages",
      "whatsapp-templates",
    ].map((id) => sections.indexOf(`<SettingsCard id="${id}">`));
    expect(order.every((at) => at > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(sections).toContain("settings-");
    // SettingsCard writes `settings-<id>` as the element's id.
    expect(sections).toContain("id={`settings-${id}`}");
  });

  test("the page is still the admin's alone", () => {
    const page = readFileSync(join(import.meta.dir, "page.tsx"), "utf8");
    expect(page).toContain('if (role !== "admin") redirect("/dashboard")');
  });

  test("the tabs and the page of the list are gone", () => {
    expect(existsSync(join(import.meta.dir, "messages/page.tsx"))).toBe(false);
    expect(
      existsSync(join(import.meta.dir, "messages/messages-tabs.tsx")),
    ).toBe(false);
  });
});

describe("the words the tabs had", () => {
  for (const [locale, messages] of [
    ["es", es],
    ["en", en],
  ] as const) {
    test(`${locale}: no key of the tabs or of the old page header is left, and the headings are the cards'`, () => {
      const m = messages.messages as Record<string, unknown>;
      for (const gone of ["tabs", "tabsLabel", "title", "description"]) {
        expect(m[gone]).toBeUndefined();
      }
      expect(
        (messages.messages.email as { heading: string }).heading.trim(),
      ).toBeTruthy();
      expect(
        (messages.messages.whatsapp as { heading: string }).heading.trim(),
      ).toBeTruthy();
    });
  }
});
