import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import es from "../../../../messages/es/dashboard.json";
import en from "../../../../messages/en/dashboard.json";
import { MessagesSettingsCard } from "./messages-card";

const render = (locale: "es" | "en") =>
  renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      messages={{ dashboard: locale === "es" ? es : en }}
    >
      <MessagesSettingsCard />
    </NextIntlClientProvider>,
  );

describe("the Messages card in Settings", () => {
  test("says what Messages is, with the title and the line asked for, and opens its two tabs directly", () => {
    const html = render("es");
    expect(html).toContain(">Mensajes<");
    expect(html).toContain(
      "Los correos y avisos de WhatsApp que el centro envía solo, y las plantillas de WhatsApp.",
    );
    expect(html).toContain('href="/dashboard/settings/messages?tab=email"');
    expect(html).toContain('href="/dashboard/settings/messages?tab=whatsapp"');
    expect(html).toContain("Mensajes automáticos");
    expect(html).toContain("Plantillas de WhatsApp");
  });

  test("and in English", () => {
    const html = render("en");
    expect(html).toContain(">Messages<");
    expect(html).toContain(
      "The emails and WhatsApp notices the centre sends on its own, and the WhatsApp templates.",
    );
    expect(html).toContain("Automatic messages");
    expect(html).toContain("WhatsApp templates");
  });

  test("its heading is a second-level heading like the other cards', in the same row height", () => {
    const html = render("es");
    expect(html).toContain("<h2");
    expect(html).toContain("h-10");
  });

  test("it sits in the settings page, first, and the page is still the admin's alone", () => {
    const sections = readFileSync(
      join(import.meta.dir, "settings-sections.tsx"),
      "utf8",
    );
    expect(sections).toContain("<MessagesSettingsCard />");
    expect(sections.indexOf("<MessagesSettingsCard />")).toBeLessThan(
      sections.indexOf("<BookingsSettings />"),
    );
    const page = readFileSync(join(import.meta.dir, "page.tsx"), "utf8");
    expect(page).toContain('if (role !== "admin") redirect("/dashboard")');
    // The page of Messages keeps its own door too.
    const messages = readFileSync(
      join(import.meta.dir, "messages/page.tsx"),
      "utf8",
    );
    expect(messages).toContain('if (role !== "admin") redirect("/dashboard")');
  });
});
