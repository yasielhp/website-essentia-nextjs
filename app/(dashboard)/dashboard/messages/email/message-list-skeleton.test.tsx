import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import es from "../../../../../messages/es/dashboard.json";
import { messageListRows } from "@/lib/messages/list-rows";
import { MessageListSkeleton } from "./message-list-skeleton";

const html = renderToStaticMarkup(
  <NextIntlClientProvider
    locale="es"
    timeZone="Atlantic/Canary"
    messages={{ dashboard: es }}
  >
    <MessageListSkeleton />
  </NextIntlClientProvider>,
);
const table = html.slice(html.indexOf("<table"), html.indexOf("</table>"));
const cards = html.slice(html.indexOf("<ul"));
const rows = messageListRows([], [], []);

describe("the list of messages while it loads", () => {
  test("has the list's own header, with its real labels, in its order", () => {
    const labels = [...table.matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map(
      (m) => m[1],
    );
    expect(labels).toEqual(["Estado", "Mensaje", "Tipo", "Contenido"]);
  });
  test("has one row per message and channel, as many as the real list, on a desk and on a phone", () => {
    expect(rows.length).toBeGreaterThan(8);
    expect(table.match(/<tr /g)!.length - 1).toBe(rows.length);
    expect(cards.match(/<li /g)!.length).toBe(rows.length);
  });
  test("an email row has a second line for its help and a WhatsApp row does not", () => {
    const bodyRows = table.split("<tr ").slice(2);
    rows.forEach((row, i) => {
      const lines = bodyRows[i].match(/h-3 w-72/g)?.length ?? 0;
      expect(lines).toBe(row.type === "email" ? 1 : 0);
    });
  });
  test("says it is busy, and has nothing to press", () => {
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<a ");
  });
});
