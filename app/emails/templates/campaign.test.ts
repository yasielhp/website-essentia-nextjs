import { describe, expect, test } from "bun:test";
import type { CampaignLocaleContent } from "@/types/campaign";
import { assembleDoc, campaignEmail } from "./campaign";

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

describe("assembleDoc", () => {
  test("wraps the body between the logo and the footer", () => {
    const doc = assembleDoc({
      content: content(),
      unsubscribeUrl: "https://x.test/u",
      locale: "es",
    });
    const types = doc.content?.map((n) => n.type);
    expect(types?.[0]).toBe("section");
    expect(doc.content?.[0]?.content?.[0]?.type).toBe("logo");
    expect(doc.content?.[0]?.attrs?.backgroundColor).toBe("#103838");
    expect(types).toContain("heading");
    expect(types).toContain("paragraph");
    expect(types?.at(-1)).toBe("footer");
  });

  test("skips the title node when the title is blank", () => {
    const doc = assembleDoc({
      content: content({ title: "  " }),
      unsubscribeUrl: "https://x.test/u",
      locale: "en",
    });
    expect(doc.content?.some((n) => n.type === "heading")).toBe(false);
  });
});

describe("campaignEmail", () => {
  test("subject fills the name as plain text, never HTML-escaped", async () => {
    expect((await render({}, "Ana & Co")).subject).toBe("Hola Ana & Co");
  });

  test("renders a full email document", async () => {
    const { html } = await render();
    expect(html.startsWith("<!DOCTYPE")).toBe(true);
    expect(html).toContain("<body");
  });

  test("fills plain-text variables in the body, escaped", async () => {
    const { html } = await render({}, "<b>Ana</b>");
    expect(html).toContain("para &lt;b&gt;Ana&lt;/b&gt;.");
    expect(html).not.toContain("{{first_name}}");
    expect(html).not.toContain("<b>Ana</b>");
  });

  test("keeps bold, button href and label as the renderer escapes them", async () => {
    const { html } = await render();
    expect(html).toContain("fuerza");
    expect(html).toMatch(/href="https:\/\/a\.test\/\?a=1&amp;b=2"/);
    expect(html).toContain("Reservar &lt;ya&gt;");
    expect(html).toContain("#103838");
  });

  test("footer copy and unsubscribe link follow the locale", async () => {
    const es = (await render()).html;
    expect(es).toContain("Recibes este email porque eres cliente de Essentia.");
    expect(es).toContain('href="https://x.test/u?token=abc"');
    expect(es).toContain("Darse de baja");

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
  });

  test("a preheader is planted hidden at the top of the body", async () => {
    const { html } = await render({ preheader: "Resumen <x> {{first_name}}" });
    expect(html).toContain(
      '<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Resumen &lt;x&gt; Ana</div>',
    );
  });

  test("an empty body still renders logo, title, address and footer", async () => {
    const { html } = await render({ doc: null });
    expect(html).toContain("logo-email.png");
    expect(html).toContain("Novedades para Ana");
    expect(html).toContain("Baobab Suites, Costa Adeje, Tenerife");
    expect(html).toContain("Darse de baja");
  });
});
