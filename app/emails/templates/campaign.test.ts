import { describe, expect, it } from "bun:test";
import {
  EMPTY_LOCALE_CONTENT,
  type CampaignLocaleContent,
} from "@/types/campaign";
import { campaignEmail } from "./campaign";

const UNSUBSCRIBE = "https://www.essentiawellnessclub.com/unsubscribe?t=abc";

function content(
  overrides: Partial<CampaignLocaleContent> = {},
): CampaignLocaleContent {
  return {
    ...EMPTY_LOCALE_CONTENT,
    subject: "Hola {{first_name}}",
    preheader: "Novedades de septiembre",
    title: "Bienvenida, {{first_name}}",
    body: "Primer párrafo.\n\nSegundo párrafo.",
    ...overrides,
  };
}

function render(
  overrides: Partial<CampaignLocaleContent> = {},
  args: {
    firstName?: string;
    locale?: "en" | "es";
    unsubscribeUrl?: string;
  } = {},
) {
  return campaignEmail({
    content: content(overrides),
    firstName: args.firstName ?? "Ana",
    unsubscribeUrl: args.unsubscribeUrl ?? UNSUBSCRIBE,
    locale: args.locale ?? "es",
  });
}

describe("campaignEmail — subject", () => {
  it("fills the name as plain text, never HTML-escaped", () => {
    expect(render({}, { firstName: "Ana & Co" }).subject).toBe("Hola Ana & Co");
  });

  it("drops the token and its leading space when there is no name", () => {
    expect(render({}, { firstName: "" }).subject).toBe("Hola");
  });
});

describe("campaignEmail — title", () => {
  it("renders the title in an h1 with the name substituted and escaped", () => {
    const { html } = render({}, { firstName: "Ana <b>x</b>" });
    expect(html).toContain(
      '<h1 style="margin:0 0 20px;font-size:26px;font-weight:600;color:#103838;line-height:1.3;">Bienvenida, Ana &lt;b&gt;x&lt;/b&gt;</h1>',
    );
  });

  it("escapes markup typed into the title itself", () => {
    const { html } = render({ title: "<script>1</script>" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;1&lt;/script&gt;");
  });
});

describe("campaignEmail — image", () => {
  it("has no image when imageUrl is empty", () => {
    expect(render().html).not.toContain('width="496"');
  });

  it("places the image when imageUrl is set", () => {
    const { html } = render({ imageUrl: "https://cdn.example.com/a.jpg" });
    expect(html).toContain(
      '<img src="https://cdn.example.com/a.jpg" alt="" width="496" style="display:block;width:100%;max-width:496px;height:auto;border:0;border-radius:12px;margin:0 0 24px;" />',
    );
  });

  it("escapes a quote in the url so it cannot close the attribute", () => {
    const { html } = render({ imageUrl: 'https://x.test/a.jpg" onerror="1' });
    expect(html).not.toContain('" onerror="');
    expect(html).toContain('src="https://x.test/a.jpg&quot; onerror=&quot;1"');
  });
});

describe("campaignEmail — body", () => {
  it("renders the paragraphs", () => {
    const { html } = render();
    expect(html).toContain('<p style="margin:0 0 16px;');
    expect(html).toContain("Primer párrafo.</p>");
    expect(html).toContain("Segundo párrafo.</p>");
  });

  it("fills the name inside the body, escaped", () => {
    const { html } = render(
      { body: "Hola {{first_name}}." },
      { firstName: "O'Neil" },
    );
    expect(html).toContain("Hola O&#39;Neil.");
  });
});

describe("campaignEmail — call to action", () => {
  it("shows nothing when only the text is set", () => {
    const { html } = render({ ctaText: "Reservar" });
    expect(html).not.toContain("Reservar");
  });

  it("shows nothing when only the url is set", () => {
    const { html } = render({ ctaUrl: "https://x.test/book" });
    expect(html).not.toContain("https://x.test/book");
  });

  it("renders a pill button when both are set", () => {
    const { html } = render({
      ctaText: "Reservar ahora",
      ctaUrl: "https://x.test/book",
    });
    expect(html).toMatch(
      /<a href="https:\/\/x\.test\/book"[^>]*style="[^"]*background-color:#103838;[^"]*color:#f0ede6;[^"]*border-radius:999px;[^"]*"[^>]*>\s*Reservar ahora\s*<\/a>/,
    );
    expect(html).toContain("padding:14px 32px;");
  });

  it("escapes the label and the href", () => {
    const { html } = render({
      ctaText: "<b>Ya</b>",
      ctaUrl: 'https://x.test/?a="1"',
    });
    expect(html).toContain("&lt;b&gt;Ya&lt;/b&gt;");
    expect(html).toContain('href="https://x.test/?a=&quot;1&quot;"');
    expect(html).not.toContain("<b>Ya</b>");
  });
});

describe("campaignEmail — footer", () => {
  it("says why in Spanish and links the unsubscribe", () => {
    const { html } = render({}, { locale: "es" });
    expect(html).toContain(
      "Recibes este email porque eres cliente de Essentia.",
    );
    expect(html).toContain(`<a href="${UNSUBSCRIBE}"`);
    expect(html).toContain("Darse de baja");
  });

  it("says why in English and links the unsubscribe", () => {
    const { html } = render({}, { locale: "en" });
    expect(html).toContain(
      "You are receiving this email because you are a client of Essentia.",
    );
    expect(html).toContain(`<a href="${UNSUBSCRIBE}"`);
    expect(html).toContain("Unsubscribe");
  });

  it("escapes the unsubscribe url", () => {
    const { html } = render({}, { unsubscribeUrl: "https://x.test/u?a=1&b=2" });
    expect(html).toContain('href="https://x.test/u?a=1&amp;b=2"');
  });

  it("is not the admin's to edit: the same text whatever the content", () => {
    const a = render({ body: "Uno" }).html;
    const b = render({ body: "Dos" }).html;
    const footer = /Recibes este email[\s\S]*?Darse de baja<\/a>/;
    expect(a.match(footer)?.[0]).toBe(b.match(footer)?.[0]);
  });
});

describe("campaignEmail — shell", () => {
  it("is a full document in the recipient's language", () => {
    expect(
      render({}, { locale: "es" }).html.startsWith("<!DOCTYPE html>"),
    ).toBe(true);
    expect(render({}, { locale: "es" }).html).toContain('<html lang="es">');
    expect(render({}, { locale: "en" }).html).toContain('<html lang="en">');
  });

  it("uses the preheader with the name filled in", () => {
    const { html } = render({ preheader: "Para ti, {{first_name}}" });
    expect(html).toContain(">Para ti, Ana</div>");
  });

  it("falls back to the title as preheader, escaped", () => {
    const { html } = render({ preheader: "", title: "Tom & Jerry" });
    expect(html).toContain(">Tom &amp; Jerry</div>");
  });
});
