import { describe, expect, it } from "bun:test";
import { shapeCampaign, shapeCampaignListing } from "./campaign-shape";

const empty = { subject: "", preheader: "", title: "", doc: null };

const email = {
  id: "c1",
  name: "Otoño",
  channel: "email",
  status: "sent",
  recipients_count: 200,
  delivered_count: 180,
  opened_count: 90,
  clicked_count: 30,
  content: {
    es: { subject: "Hola", preheader: "p", title: "t", doc: { type: "doc" } },
    en: empty,
  },
};

const whatsapp = {
  id: "c2",
  name: "Reapertura",
  channel: "whatsapp",
  status: "sent",
  recipients_count: 100,
  delivered_count: 80,
  opened_count: 40,
  clicked_count: 0,
  content: {
    es: empty,
    en: empty,
    whatsapp: {
      templateId: "6f1c2a3e-1111-4222-8333-444455556666",
      params: [
        { kind: "field", field: "first_name" },
        { kind: "static", value: "Ana García, 600112233" },
      ],
    },
  },
};

describe("shapeCampaign", () => {
  it("an email keeps the summary and the three rates it always had", () => {
    const shaped = shapeCampaign(email) as Record<string, unknown>;
    expect(shaped.channel).toBe("email");
    expect(shaped.rates_percent).toEqual({
      delivered: 90,
      opened: 50,
      clicked: 16.7,
    });
    expect(shaped.content_summary).toEqual({
      es: { subject: "Hola", preheader: "p", title: "t", body_characters: 14 },
      en: { subject: "", preheader: "", title: "", body_characters: 0 },
    });
    expect(shaped).not.toHaveProperty("whatsapp");
    expect(shaped).not.toHaveProperty("content");
  });

  it("a WhatsApp campaign says its channel and which template, with how many parameters", () => {
    const shaped = shapeCampaign(whatsapp) as Record<string, unknown>;
    expect(shaped.channel).toBe("whatsapp");
    expect(shaped.whatsapp).toEqual({
      template_id: "6f1c2a3e-1111-4222-8333-444455556666",
      parameter_count: 2,
    });
  });

  it("never carries what the admin typed into a fixed parameter", () => {
    const text = JSON.stringify(shapeCampaign(whatsapp));
    expect(text).not.toContain("Ana García");
    expect(text).not.toContain("600112233");
  });

  it("reports reads, not opens, and no clicks: Meta gives no clicks", () => {
    const shaped = shapeCampaign(whatsapp) as {
      rates_percent: Record<string, unknown>;
    };
    expect(shaped.rates_percent).toEqual({ delivered: 80, read: 50 });
  });

  it("an older row with no channel is an email", () => {
    const old = { ...email } as Record<string, unknown>;
    delete old.channel;
    expect((shapeCampaign(old) as Record<string, unknown>).channel).toBe(
      "email",
    );
  });

  it("a WhatsApp campaign with no template chosen yet says so", () => {
    const bare = {
      ...whatsapp,
      content: { es: empty, en: empty },
    };
    expect((shapeCampaign(bare) as Record<string, unknown>).whatsapp).toEqual({
      template_id: null,
      parameter_count: 0,
    });
  });
});

describe("shapeCampaignListing", () => {
  it("keeps the channel on each row of the list", () => {
    const rows = shapeCampaignListing([
      { id: "a", channel: "whatsapp", opened_count: 3, clicked_count: 0 },
      { id: "b", opened_count: 1, clicked_count: 2 },
    ]);
    expect(rows.map((r) => r.channel)).toEqual(["whatsapp", "email"]);
  });

  it("names the counters for what they are on WhatsApp", () => {
    const [row] = shapeCampaignListing([
      { id: "a", channel: "whatsapp", opened_count: 3, clicked_count: 0 },
    ]);
    expect(row).toMatchObject({ read_count: 3 });
    expect(row).not.toHaveProperty("opened_count");
    expect(row).not.toHaveProperty("clicked_count");
  });

  it("leaves an email's counters as they were", () => {
    const [row] = shapeCampaignListing([
      { id: "b", channel: "email", opened_count: 1, clicked_count: 2 },
    ]);
    expect(row).toMatchObject({ opened_count: 1, clicked_count: 2 });
  });
});
