import { describe, expect, it } from "bun:test";
import { composeMessageEmail } from "./compose";
import { linkButtonNode } from "./editor-state";
import { buildPreviewEmail } from "./preview";
import { legacySampleEmail } from "./samples";

const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

describe("buildPreviewEmail", () => {
  it("a draft that changes nothing shows the email that has always gone out", async () => {
    const out = await buildPreviewEmail("booking_confirmed", "es", null);
    expect(out.html).toBe(legacySampleEmail("booking_confirmed", "es"));
  });

  it("an empty list of changes is the same as none", async () => {
    const out = await buildPreviewEmail("booking_confirmed", "es", {});
    expect(out.html).toBe(legacySampleEmail("booking_confirmed", "es"));
  });

  it("a changed subject fills the variables with the example booking", async () => {
    const out = await buildPreviewEmail("booking_confirmed", "es", {
      subject: "Hasta pronto, {{first_name}}",
    });
    expect(out.subject).toBe("Hasta pronto, Ana");
  });

  it("a changed body is drawn with the fixed blocks after it", async () => {
    const out = await buildPreviewEmail("booking_confirmed", "es", {
      doc: doc("Un texto mío para {{first_name}}") as never,
    });
    expect(out.html).toContain("Un texto mío para Ana");
    expect(out.html.indexOf("Un texto mío")).toBeLessThan(
      out.html.indexOf("example.com/cancel"),
    );
  });

  it("the button of a link variable is shown with the example link, though a client with no link gets no button", async () => {
    const body = {
      type: "doc",
      content: [
        ...doc("Firma antes de venir.").content,
        linkButtonNode("consent_url", "es"),
      ],
    } as never;
    const label = (
      linkButtonNode("consent_url", "es").attrs as { text: string }
    ).text;
    // The preview always has an example link, so the admin sees the button.
    const preview = await buildPreviewEmail("booking_confirmed", "es", {
      doc: body,
    });
    expect(preview.html).toContain(label);
    expect(preview.html).toContain('href="https://example.com/consent');
    // A client who has already signed has no link: the button is not sent.
    const signed = await composeMessageEmail({
      key: "booking_confirmed",
      locale: "es",
      row: {
        subject: null,
        preheader: null,
        title: null,
        doc: body,
        enabled: true,
      },
      vars: { first_name: "Ana", service: "Drenaje", consent_url: "" },
      blocks: {},
    });
    expect(signed.html).toContain("Firma antes de venir.");
    expect(signed.html).not.toContain(label);
    expect(signed.html).not.toContain('href="#"');
  });

  it("is the same email the test sends: the preview and the test cannot differ", async () => {
    const { buildTestEmail } = await import("./test-email");
    const row = {
      subject: "Hola {{first_name}}",
      preheader: null,
      title: null,
      doc: doc("Texto") as never,
      enabled: true,
    };
    const preview = await buildPreviewEmail("bonus_purchase", "en", {
      subject: row.subject,
      doc: row.doc,
    });
    expect(preview).toEqual(await buildTestEmail("bonus_purchase", "en", row));
  });
});
