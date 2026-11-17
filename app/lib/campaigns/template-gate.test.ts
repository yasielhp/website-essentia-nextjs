import { describe, expect, test } from "bun:test";
import { chainDb } from "./fake-db";
import { templateGate } from "./template-gate";
import { campaign, template } from "./whatsapp-fixtures";

const whatsapp = (overrides = {}) =>
  campaign({
    channel: "whatsapp",
    audience: {
      language: "es",
      newsletter: null,
      services: [],
      lastBooking: null,
      neverBooked: false,
      manualIds: [],
      sendLocale: "es",
    },
    content: {
      en: { subject: "", preheader: "", title: "", doc: null },
      es: { subject: "", preheader: "", title: "", doc: null },
      whatsapp: {
        templateId: "tpl-1",
        params: [
          { kind: "field", field: "first_name" },
          { kind: "static", value: "x" },
        ],
      },
    },
    ...overrides,
  });

const dbWith = (answer: unknown) => {
  const reads: string[] = [];
  const { db } = chainDb(async (table) => {
    reads.push(table);
    return answer;
  });
  return { db, reads };
};

describe("templateGate", () => {
  test("an email never touches the templates", async () => {
    const { db, reads } = dbWith({ data: null, error: null });
    expect(await templateGate(campaign({ channel: "email" }), db)).toBeNull();
    expect(reads).toEqual([]);
  });

  test("a WhatsApp campaign whose template can go out passes", async () => {
    const { db } = dbWith({ data: template(), error: null });
    expect(await templateGate(whatsapp(), db)).toBeNull();
  });

  test("a template paused since the campaign was saved is refused with its code", async () => {
    const { db } = dbWith({
      data: template({ status: "PAUSED" }),
      error: null,
    });
    expect(await templateGate(whatsapp(), db)).toEqual({
      ok: false,
      error: "template_unavailable",
      detail: "template_not_approved",
    });
  });

  test("a template that was deleted is refused", async () => {
    const { db } = dbWith({ data: null, error: null });
    expect(await templateGate(whatsapp(), db)).toEqual({
      ok: false,
      error: "template_unavailable",
      detail: "template_missing",
    });
  });

  test("a campaign with no template chosen is refused", async () => {
    const { db } = dbWith({ data: null, error: null });
    const bare = whatsapp();
    delete (bare.content as { whatsapp?: unknown }).whatsapp;
    expect(await templateGate(bare, db)).toMatchObject({
      error: "template_unavailable",
      detail: "template_missing",
    });
  });

  test("a template in another language than the campaign is refused", async () => {
    const { db } = dbWith({ data: template({ language: "en" }), error: null });
    expect(await templateGate(whatsapp(), db)).toMatchObject({
      detail: "template_language",
    });
  });

  test("the wrong number of parameters is refused", async () => {
    const { db } = dbWith({ data: template({ param_count: 3 }), error: null });
    expect(await templateGate(whatsapp(), db)).toMatchObject({
      detail: "param_count",
    });
  });

  test("a read that fails is a database error, not an unavailable template", async () => {
    const { db } = dbWith({ data: null, error: { message: "relation x" } });
    const failure = await templateGate(whatsapp(), db);
    expect(failure).toEqual({ ok: false, error: "db" });
  });

  test("an appointment notice with a Marketing template is refused, with its code", async () => {
    const { db } = dbWith({ data: template(), error: null });
    expect(await templateGate(whatsapp({ kind: "appointment" }), db)).toEqual({
      ok: false,
      error: "template_unavailable",
      detail: "template_category",
    });
  });

  test("the same notice with a Utility template passes, and a marketing campaign never looked", async () => {
    const utility = dbWith({
      data: template({ category: "UTILITY" }),
      error: null,
    });
    expect(
      await templateGate(whatsapp({ kind: "appointment" }), utility.db),
    ).toBeNull();
    const marketing = dbWith({ data: template(), error: null });
    expect(
      await templateGate(whatsapp({ kind: "standard" }), marketing.db),
    ).toBeNull();
    expect(
      await templateGate(whatsapp({ kind: "automated" }), marketing.db),
    ).toBeNull();
  });
});
