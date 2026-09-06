import { describe, expect, test } from "bun:test";
import type { CampaignLocaleContent } from "@/types/campaign";
import { campaignEmail, renderBodyFragment } from "./campaign";

const content = (
  over: Partial<CampaignLocaleContent> = {},
): CampaignLocaleContent => ({
  subject: "Hola {{first_name}}",
  preheader: "",
  title: "Novedades para {{first_name}}",
  doc: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Primer párrafo con " },
          { type: "text", text: "fuerza", marks: [{ type: "bold" }] },
          { type: "text", text: " para {{first_name}}." },
        ],
      },
      {
        type: "button",
        attrs: {
          text: "Reservar <ya>",
          url: "https://a.test/?a=1&b=2",
          alignment: "center",
          variant: "filled",
          borderRadius: "round",
          buttonColor: "#103838",
          textColor: "#f0ede6",
        },
      },
    ],
  },
  ...over,
});

const render = (over: Partial<CampaignLocaleContent> = {}, firstName = "Ana") =>
  campaignEmail({
    content: content(over),
    firstName,
    unsubscribeUrl: "https://x.test/u?token=abc",
    locale: "es",
  });

describe("renderBodyFragment", () => {
  test("is a fragment: no document, no stream markers, inline styles only", async () => {
    const fragment = await renderBodyFragment(content().doc, {
      first_name: "",
    });
    expect(fragment.startsWith("<table")).toBe(true);
    expect(fragment).not.toContain("<html");
    expect(fragment).not.toContain("<body");
    expect(fragment).not.toContain("<!--$");
    expect(fragment).not.toContain("<!--html-->");
    expect(fragment).not.toContain("<style");
  });

  test("renders an empty document to an (almost) empty fragment", async () => {
    const fragment = await renderBodyFragment(null, {});
    expect(fragment).not.toContain("<p");
  });
});

describe("campaignEmail", () => {
  test("subject fills the name as plain text, never HTML-escaped", async () => {
    expect((await render({}, "Ana & Co")).subject).toBe("Hola Ana & Co");
  });

  test("uses the house shell: sand page, dark header with the logo, address", async () => {
    const { html } = await render();
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain("background-color:#f5f2ed");
    expect(html).toContain("background-color:#103838;padding:24px 32px");
    expect(html).toContain("logo-email.png");
    expect(html).toContain("Baobab Suites, Costa Adeje, Tenerife");
  });

  test("fills plain-text variables in title and body, escaped", async () => {
    const { html } = await render({}, "<b>Ana</b>");
    expect(html).toContain("Novedades para &lt;b&gt;Ana&lt;/b&gt;</h1>");
    expect(html).toContain("para &lt;b&gt;Ana&lt;/b&gt;.");
    expect(html).not.toContain("{{first_name}}");
    expect(html).not.toContain("<b>Ana</b>");
  });

  test("keeps bold, button href and label as the renderer escapes them", async () => {
    const { html } = await render();
    expect(html).toContain("<strong>fuerza</strong>");
    expect(html).toMatch(/href="https:\/\/a\.test\/\?a=1&amp;b=2"/);
    expect(html).toContain("Reservar &lt;ya&gt;");
  });

  test("footer copy and unsubscribe link follow the locale", async () => {
    const es = (await render()).html;
    expect(es).toContain("Recibes este email porque eres cliente de Essentia.");
    // Under the address, not above it.
    expect(es.indexOf("Baobab Suites")).toBeLessThan(
      es.indexOf("Recibes este email"),
    );
    expect(es).toContain('href="https://x.test/u?token=abc"');
    expect(es).toContain("Darse de baja");
    expect(es).toContain('lang="es"');

    const en = (
      await campaignEmail({
        content: content(),
        firstName: "Ann",
        unsubscribeUrl: "https://x.test/u",
        locale: "en",
      })
    ).html;
    expect(en).toContain(
      "You are receiving this email because you are a client of Essentia.",
    );
    expect(en).toContain("Unsubscribe");
    expect(en).not.toContain("Darse de baja");
    expect(en).toContain('lang="en"');
  });

  test("the preheader is the hidden first text, falling back to the title", async () => {
    expect(
      (await render({ preheader: "Resumen <x> {{first_name}}" })).html,
    ).toContain('mso-hide:all;">Resumen &lt;x&gt; Ana</div>');
    expect((await render()).html).toContain(
      'mso-hide:all;">Novedades para Ana</div>',
    );
  });

  test("an empty body still renders shell, title and footer", async () => {
    const { html } = await render({ doc: null });
    expect(html).toContain("Novedades para Ana</h1>");
    expect(html).toContain("Darse de baja");
  });
});
