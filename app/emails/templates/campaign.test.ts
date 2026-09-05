import { describe, expect, test } from "bun:test";
import type { CampaignLocaleContent } from "@/types/campaign";
import { campaignEmail, renderBlock } from "./campaign";

const content = (
  over: Partial<CampaignLocaleContent> = {},
): CampaignLocaleContent => ({
  subject: "Hola {{first_name}}",
  preheader: "",
  title: "Novedades para {{first_name}}",
  blocks: [
    { type: "paragraph", text: "Primer párrafo.\n\nSegundo **fuerte**." },
  ],
  ...over,
});

const render = (over: Partial<CampaignLocaleContent> = {}, firstName = "Ana") =>
  campaignEmail({
    content: content(over),
    firstName,
    unsubscribeUrl: "https://x.test/u?token=abc",
    locale: "es",
  });

describe("campaignEmail — subject", () => {
  test("fills the name as plain text, never HTML-escaped", () => {
    expect(render({}, "Ana & Co").subject).toBe("Hola Ana & Co");
  });

  test("drops the token and its leading space when there is no name", () => {
    expect(render({}, "").subject).toBe("Hola");
  });
});

describe("campaignEmail — title and preheader", () => {
  test("escapes the name inside the title", () => {
    expect(render({}, "<b>").html).toContain("Novedades para &lt;b&gt;</h1>");
  });

  test("escapes a tag typed into the title", () => {
    const { html } = render({ title: "<script>x</script>" });
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;");
    expect(html).not.toContain("<script>");
  });

  test("falls back to the escaped title when the preheader is empty", () => {
    expect(render({ title: "A & B" }).html).toContain("A &amp; B</div>");
  });
});

describe("campaignEmail — blocks", () => {
  test("renders paragraphs with the three inline constructs", () => {
    const { html } = render();
    expect(html).toContain("<p style=");
    expect(html).toContain("<strong>fuerte</strong>");
  });

  test("renders a heading, escaped and with the name filled", () => {
    const { html } = render({
      blocks: [{ type: "heading", text: "Hola {{first_name}} <i>" }],
    });
    expect(html).toContain("<h2 style=");
    expect(html).toContain("Hola Ana &lt;i&gt;</h2>");
  });

  test("renders an image with escaped src and alt", () => {
    const { html } = render({
      blocks: [
        { type: "image", url: 'https://a.test/x.png?q="1', alt: "Sala <ok>" },
      ],
    });
    expect(html).toContain('src="https://a.test/x.png?q=&quot;1"');
    expect(html).toContain('alt="Sala &lt;ok&gt;"');
  });

  test("renders a button as a pill link with href and label escaped", () => {
    const { html } = render({
      blocks: [
        {
          type: "button",
          text: "Reserva <ya>",
          url: "https://a.test/?a=1&b=2",
        },
      ],
    });
    expect(html).toMatch(
      /<a href="https:\/\/a\.test\/\?a=1&amp;b=2"[^>]*border-radius:999px/,
    );
    expect(html).toContain("Reserva &lt;ya&gt;");
  });

  test("skips a half-filled button and an image without url", () => {
    const { html } = render({
      blocks: [
        { type: "button", text: "Solo texto", url: "" },
        { type: "image", url: "", alt: "" },
      ],
    });
    expect(html).not.toContain("border-radius:999px");
    expect(html).not.toContain('width="496"');
  });

  test("renders a divider", () => {
    expect(render({ blocks: [{ type: "divider" }] }).html).toContain("<hr ");
  });

  test("keeps block order", () => {
    const { html } = render({
      blocks: [
        { type: "heading", text: "Uno" },
        { type: "divider" },
        { type: "paragraph", text: "Dos" },
      ],
    });
    expect(html.indexOf("Uno")).toBeLessThan(html.indexOf("<hr "));
    expect(html.indexOf("<hr ")).toBeLessThan(html.indexOf("Dos"));
  });

  test("an unknown block renders nothing", () => {
    // Stored JSON may carry a shape a newer or older build does not know.
    const stray = {
      type: "video",
      url: "https://a.test",
    } as unknown as Parameters<typeof renderBlock>[0];
    expect(renderBlock(stray, { first_name: "" })).toBe("");
  });
});

describe("campaignEmail — shell and footer", () => {
  test("wraps in the base shell with the locale", () => {
    const { html } = render();
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain('lang="es"');
  });

  test("footer copy and unsubscribe link follow the locale", () => {
    const es = render().html;
    expect(es).toContain("Recibes este email porque eres cliente de Essentia.");
    expect(es).toContain('href="https://x.test/u?token=abc"');
    expect(es).toContain("Darse de baja");

    const en = campaignEmail({
      content: content(),
      firstName: "Ann",
      unsubscribeUrl: "https://x.test/u?a=1&b=2",
      locale: "en",
    }).html;
    expect(en).toContain(
      "You are receiving this email because you are a client of Essentia.",
    );
    expect(en).toContain('href="https://x.test/u?a=1&amp;b=2"');
    expect(en).toContain("Unsubscribe");
    expect(en).not.toContain("Darse de baja");
  });

  test("the footer is not the admin's to edit", () => {
    const a = render({ blocks: [{ type: "paragraph", text: "a" }] }).html;
    const b = render({ blocks: [{ type: "paragraph", text: "b" }] }).html;
    const footerOf = (html: string) =>
      html.slice(html.indexOf("Recibes este email"));
    expect(footerOf(a)).toBe(footerOf(b));
  });
});
