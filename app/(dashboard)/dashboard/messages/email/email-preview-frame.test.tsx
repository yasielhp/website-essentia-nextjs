import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import es from "../../../../../messages/es/dashboard.json";
import en from "../../../../../messages/en/dashboard.json";
import { EmailPreviewFrame } from "./email-preview-frame";

const render = (
  html: string | null,
  over: { failed?: boolean; failure?: string | null } = {},
  locale: "es" | "en" = "es",
) =>
  renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      timeZone="Atlantic/Canary"
      messages={{ dashboard: locale === "es" ? es : en }}
    >
      <EmailPreviewFrame
        html={html}
        failed={over.failed ?? false}
        failure={over.failure ?? null}
      />
    </NextIntlClientProvider>,
  );

describe("the preview of an email", () => {
  const html = render("<p>Hola</p>");

  test("is one view: no Mobile / Desktop switch, nothing to press", () => {
    expect(html).not.toContain("Móvil");
    expect(html).not.toContain("Escritorio");
    expect(html).not.toContain("<button");
  });
  test("repeats neither the subject nor the note about the example", () => {
    expect(html).not.toContain("Asunto");
    // The note is there for a screen reader only, as the frame's description.
    expect(html).toContain('id="message-preview-note"');
    expect(html).toContain("sr-only");
    expect(html).toContain('aria-describedby="message-preview-note"');
    expect(html.indexOf("sr-only")).toBeLessThan(html.indexOf("<iframe"));
  });
  test("keeps its small label, and the frame is sandboxed and as wide as its column", () => {
    expect(html).toContain("Así se verá el correo");
    expect(html).toContain('sandbox=""');
    expect(html).toContain("w-full");
    expect(html).not.toContain("width:375");
  });
  test("while the first one is prepared, it says so", () => {
    expect(render(null)).toContain("Preparando la vista previa…");
  });
  test("a draft that cannot be drawn says so over the last one that could", () => {
    expect(render("<p>x</p>", { failed: true })).toContain(
      "No se puede mostrar la vista previa",
    );
    expect(
      render("<p>x</p>", { failed: true, failure: "Sesión caducada" }),
    ).toContain("Sesión caducada");
  });
  test("English", () => {
    expect(render("<p>x</p>", {}, "en")).toContain("How the email will look");
  });
});
