import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import es from "../../../../../../messages/es/dashboard.json";
import en from "../../../../../../messages/en/dashboard.json";
import { SyncStamp } from "./sync-stamp";

const NOW = Date.parse("2026-11-24T12:00:00.000Z");
const AT = (ms: number) => NOW - ms;
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const render = (at: number, locale: "es" | "en" = "es") =>
  renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      timeZone="Atlantic/Canary"
      now={new Date(NOW)}
      messages={{ dashboard: locale === "es" ? es : en }}
    >
      <SyncStamp at={at} now={NOW} />
    </NextIntlClientProvider>,
  );
const words = (html: string) =>
  html.replace(/<[^>]*>/g, "").replace(/\s/g, " ");

describe("the line that says when the templates were brought from Meta", () => {
  test("in Spanish: a moment ago, minutes, hours, days", () => {
    expect(words(render(AT(20_000)))).toBe("Actualizado hace un momento");
    expect(words(render(AT(3 * MIN + 30_000)))).toBe("Actualizado hace 3 min");
    expect(words(render(AT(2 * HOUR + 10 * MIN)))).toBe("Actualizado hace 2 h");
    expect(words(render(AT(3 * DAY + HOUR)))).toBe("Actualizado hace 3 días");
  });

  test("in English", () => {
    expect(words(render(AT(20_000), "en"))).toBe("Updated a moment ago");
    expect(words(render(AT(3 * MIN), "en"))).toContain("Updated 3 min");
    expect(words(render(AT(3 * DAY), "en"))).toBe("Updated 3 days ago");
  });

  test("the exact date is not lost: <time dateTime> holds it and the tooltip says it", () => {
    const html = render(Date.parse("2026-11-24T10:34:00.000Z"));
    expect(html).toContain('<time dateTime="2026-11-24T10:34:00.000Z"');
    expect(html).toContain(
      'title="Actualizado desde Meta: 24 nov 2026, 10:34"',
    );
  });

  test("small and muted, and not a live region: it changes every minute and must not be read out each time", () => {
    const html = render(AT(MIN));
    expect(html).toContain("text-xs");
    expect(html).toContain("text-petroleum-400");
    expect(html).not.toContain("role=");
    expect(html).not.toContain("aria-live");
  });

  test("it depends on the browser's hour, so the <time> says a mismatch with the server's hour is expected", () => {
    const source = readFileSync(
      join(import.meta.dir, "sync-stamp.tsx"),
      "utf8",
    );
    expect(source).toContain("suppressHydrationWarning");
  });
});

describe("where the panel puts it", () => {
  const panel = readFileSync(
    join(import.meta.dir, "templates-panel.tsx"),
    "utf8",
  );

  test("under the New template button, CENTRED on its axis, in one column that goes wherever the button goes", () => {
    const start = panel.indexOf("const actions = (");
    const block = panel.slice(start, panel.indexOf("return (", start));
    expect(block).toContain("flex-col items-center");
    expect(block).not.toContain("items-end");
    // The line is not allowed to wrap: a longer line widens the column, centred on the same axis.
    expect(block).toContain("whitespace-nowrap");
    expect(block.indexOf("<Button")).toBeLessThan(block.indexOf("<SyncStamp"));
  });

  test("never synced: no line (and while it syncs, the line says so instead of an age)", () => {
    expect(panel).toContain("lastSync !== null && <SyncStamp");
    expect(panel).toContain('t("autoSync.updating")');
  });

  test("the absolute text that sat under the description is gone from the intro, and the clock ticks once a minute", () => {
    expect(panel).not.toContain("updatedAt");
    expect(panel).toContain("useNow()");
    const hook = readFileSync(
      join(import.meta.dir, "../../../../../hooks/use-now.ts"),
      "utf8",
    );
    expect(hook).toContain("60_000");
  });
});
