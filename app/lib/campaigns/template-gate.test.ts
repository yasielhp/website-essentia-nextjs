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
      locale: "es",
    });
  });

  test("a template that was deleted is refused", async () => {
    const { db } = dbWith({ data: null, error: null });
    expect(await templateGate(whatsapp(), db)).toEqual({
      ok: false,
      error: "template_unavailable",
      detail: "template_missing",
      locale: "es",
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
      locale: "es",
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

  describe("a campaign for both languages has a template in each, and both are checked", () => {
    const TEMPLATES: Record<string, ReturnType<typeof template> | null> = {
      "tpl-es": template({ id: "tpl-es", language: "es", param_count: 1 }),
      "tpl-en": template({ id: "tpl-en", language: "en", param_count: 1 }),
    };
    const name = { kind: "field" as const, field: "first_name" as const };
    const bilingual = (over = {}) =>
      whatsapp({
        audience: {
          language: "any",
          newsletter: null,
          services: [],
          lastBooking: null,
          neverBooked: false,
          manualIds: [],
        },
        content: {
          en: { subject: "", preheader: "", title: "", doc: null },
          es: { subject: "", preheader: "", title: "", doc: null },
          whatsapp: {
            es: { templateId: "tpl-es", params: [name] },
            en: { templateId: "tpl-en", params: [name] },
          },
        },
        ...over,
      });
    /** Answers each template by the id it is asked for. */
    const byId = (templates: typeof TEMPLATES) => {
      const asked: string[] = [];
      const { db } = chainDb(async (_table, chain) => {
        const id = String(
          chain.find((step) => step.name === "eq" && step.args[0] === "id")
            ?.args[1],
        );
        asked.push(id);
        return { data: templates[id] ?? null, error: null };
      });
      return { db, asked };
    };

    test("with both sendable it passes, having read the two", async () => {
      const { db, asked } = byId(TEMPLATES);
      expect(await templateGate(bilingual(), db)).toBeNull();
      expect(asked.sort()).toEqual(["tpl-en", "tpl-es"]);
    });

    test("the English one paused refuses it, and the refusal says English", async () => {
      const { db } = byId({
        ...TEMPLATES,
        "tpl-en": template({ id: "tpl-en", language: "en", status: "PAUSED" }),
      });
      expect(await templateGate(bilingual(), db)).toEqual({
        ok: false,
        error: "template_unavailable",
        detail: "template_not_approved",
        locale: "en",
      });
    });

    test("no English template chosen refuses it the same way", async () => {
      const { db } = byId(TEMPLATES);
      const onlySpanish = bilingual();
      (onlySpanish.content as { whatsapp: unknown }).whatsapp = {
        es: { templateId: "tpl-es", params: [name] },
      };
      expect(await templateGate(onlySpanish, db)).toMatchObject({
        detail: "template_missing",
        locale: "en",
      });
    });

    test("a Spanish template put in the English slot is the wrong language", async () => {
      const { db } = byId({ ...TEMPLATES, "tpl-en": TEMPLATES["tpl-es"]! });
      expect(await templateGate(bilingual(), db)).toMatchObject({
        detail: "template_language",
        locale: "en",
      });
    });

    test("an audience that fixes Spanish never reads the English one", async () => {
      const { db, asked } = byId({ "tpl-es": TEMPLATES["tpl-es"]! });
      const spanish = bilingual();
      (spanish.audience as { language: string }).language = "es";
      expect(await templateGate(spanish, db)).toBeNull();
      expect(asked).toEqual(["tpl-es"]);
    });

    test("an appointment notice needs a Utility template in each language", async () => {
      const { db } = byId({
        "tpl-es": template({
          id: "tpl-es",
          language: "es",
          param_count: 1,
          category: "UTILITY",
        }),
        "tpl-en": TEMPLATES["tpl-en"]!,
      });
      expect(
        await templateGate(bilingual({ kind: "appointment" }), db),
      ).toMatchObject({ detail: "template_category", locale: "en" });
    });
  });
});
