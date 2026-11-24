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

const TEMPLATE_ES = "6f1c2a3e-1111-4222-8333-444455556666";
const TEMPLATE_EN = "7a2d3b4f-2222-4333-8444-555566667777";

/** For everybody, with a template for each language: the shape the form writes. */
const whatsapp = {
  id: "c2",
  name: "Reapertura",
  channel: "whatsapp",
  status: "sent",
  recipients_count: 100,
  delivered_count: 80,
  opened_count: 40,
  clicked_count: 0,
  audience: { language: "any" },
  content: {
    es: empty,
    en: empty,
    whatsapp: {
      es: {
        templateId: TEMPLATE_ES,
        params: [
          { kind: "field", field: "first_name" },
          { kind: "static", value: "Ana García, 600112233" },
        ],
      },
      en: {
        templateId: TEMPLATE_EN,
        params: [{ kind: "field", field: "first_name" }],
      },
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

  it("a WhatsApp campaign says its channel and, for each language, its template and where each parameter comes from", () => {
    const shaped = shapeCampaign(whatsapp) as Record<string, unknown>;
    expect(shaped.channel).toBe("whatsapp");
    expect(shaped.whatsapp).toEqual({
      by_language: {
        es: {
          template_id: TEMPLATE_ES,
          parameter_count: 2,
          parameters: [{ from: "first_name" }, { from: "fixed_text" }],
        },
        en: {
          template_id: TEMPLATE_EN,
          parameter_count: 1,
          parameters: [{ from: "first_name" }],
        },
      },
    });
  });

  it("a campaign saved in the old shape (one template, no language) has it under the language it was sent in", () => {
    const old = {
      ...whatsapp,
      audience: { language: "any", sendLocale: "en" },
      content: {
        es: empty,
        en: empty,
        whatsapp: {
          templateId: TEMPLATE_ES,
          params: [{ kind: "static", value: "Ana García, 600112233" }],
        },
      },
    };
    expect((shapeCampaign(old) as Record<string, unknown>).whatsapp).toEqual({
      by_language: {
        es: null,
        en: {
          template_id: TEMPLATE_ES,
          parameter_count: 1,
          parameters: [{ from: "fixed_text" }],
        },
      },
    });
  });

  it("an audience that fixes a language lists that language alone", () => {
    const spanish = { ...whatsapp, audience: { language: "es" } };
    expect(
      Object.keys(
        (
          (shapeCampaign(spanish) as Record<string, unknown>).whatsapp as {
            by_language: object;
          }
        ).by_language,
      ),
    ).toEqual(["es"]);
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

  it("a WhatsApp campaign with no template chosen yet says so, language by language", () => {
    const bare = {
      ...whatsapp,
      content: { es: empty, en: empty },
    };
    expect((shapeCampaign(bare) as Record<string, unknown>).whatsapp).toEqual({
      by_language: { es: null, en: null },
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
