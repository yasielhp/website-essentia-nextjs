import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import es from "../../../../messages/es/dashboard.json";
import type { CampaignRow } from "@/types/campaign";
import { CampaignTable } from "./campaign-table";

const campaign = {
  id: "c1",
  name: "Reapertura",
  status: "sent",
  channel: "whatsapp",
  kind: "standard",
  trigger: {},
  recipients_count: 5,
  delivered_count: 3,
  opened_count: 1,
  clicked_count: 0,
  failed_count: 0,
  bounced_count: 0,
  complained_count: 0,
  sent_at: "2026-11-17T10:00:00Z",
  scheduled_at: null,
  updated_at: "2026-11-17T10:00:00Z",
} as unknown as CampaignRow;

const html = renderToStaticMarkup(
  <NextIntlClientProvider
    locale="es"
    timeZone="Atlantic/Canary"
    messages={{ dashboard: es }}
  >
    <CampaignTable
      campaigns={[campaign]}
      loading={false}
      page={0}
      totalPages={1}
      onPage={() => {}}
      onOpen={() => {}}
      locale="es"
    />
  </NextIntlClientProvider>,
);

describe("the campaign list, for a keyboard", () => {
  test("the name of a row is a button, in the table and in the cards", () => {
    const table = html.slice(html.indexOf("<table"), html.indexOf("</table>"));
    const cards = html.slice(html.indexOf('<ul class="divide-sand-100'));
    expect(table).toMatch(/<button[^>]*>Reapertura<\/button>/);
    expect(cards).toMatch(/<button[^>]*>Reapertura<\/button>/);
  });
  test("with a focus ring a keyboard can see", () => {
    expect(html).toContain("focus-visible:ring-2");
  });
});
