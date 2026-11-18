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
  test("keeps its small label, and the frame is as wide as its column", () => {
    expect(html).toContain("Vista previa");
    expect(html).toContain("w-full");
    expect(html).not.toContain("width:375");
  });
  test("the frame's sandbox allows the reading of its height and nothing else: no script, no form, no window", () => {
    const sandbox = html.match(/sandbox="([^"]*)"/)?.[1];
    expect(sandbox).toBe("allow-same-origin");
    expect(html).not.toContain("allow-scripts");
    expect(html).not.toContain("allow-forms");
    expect(html).not.toContain("allow-popups");
    expect(html).not.toContain("allow-top-navigation");
  });
  test("nothing wraps the email: no box, no padding, no scroll bar of its own", () => {
    const frame = html.slice(html.indexOf("<iframe"));
    const before = html.slice(0, html.indexOf("<iframe"));
    // The frame is not inside a bordered, padded box any more.
    expect(before).not.toContain("border-sand-200");
    expect(before).not.toContain("bg-sand-50");
    expect(before).not.toMatch(/class="[^"]*\bp-3\b/);
    expect(frame).toContain('scrolling="no"');
    expect(frame).toContain("border-0");
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
    expect(render("<p>x</p>", {}, "en")).toContain("Preview");
  });
});
