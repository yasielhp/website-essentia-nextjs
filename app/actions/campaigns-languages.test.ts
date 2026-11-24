import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import type { TemplateSend } from "@/lib/whatsapp/client";
import { chainDb } from "@/lib/campaigns/fake-db";
import { template } from "@/lib/campaigns/whatsapp-fixtures";

/**
 * A campaign in two languages, through the real actions with the role check,
 * the database, Meta and the mailer replaced: a save checks the WhatsApp
 * template of EACH language of the audience, and a test is of ONE language,
 * the one on the admin's screen.
 */

const TPL_ES = "6f1c2a3e-1111-4222-8333-444455556666";
const TPL_EN = "7a2d3b4f-2222-4333-8444-555566667777";
type Template = ReturnType<typeof template>;

const spanish = (over: Partial<Template> = {}) =>
  template({
    id: TPL_ES,
    name: "reapertura",
    language: "es",
    param_count: 1,
    example_params: ["Ana"],
    ...over,
  });
const english = (over: Partial<Template> = {}) =>
  template({
    id: TPL_EN,
    name: "reopening",
    language: "en",
    param_count: 1,
    example_params: ["Anna"],
    ...over,
  });

let templates: Record<string, Template | null> = {};
let templateReads: string[] = [];
let writes: unknown[] = [];
let adminId = "admin-1";
let messages: TemplateSend[] = [];
let emails: { to: string; subject: string }[] = [];
let rendered: { locale: string; subject: string }[] = [];

const real = {
  guard: { ...(await import("@/lib/auth-guard")) },
  admin: { ...(await import("@/lib/insforge-admin")) },
  cache: { ...(await import("next/cache")) },
  client: { ...(await import("@/lib/whatsapp/client")) },
  send: { ...(await import("@/emails/send")) },
  email: { ...(await import("@/emails/templates/campaign")) },
};
let saveCampaign: typeof import("./campaigns").saveCampaign;
let sendTestWhatsAppCampaign: typeof import("./campaigns").sendTestWhatsAppCampaign;
let sendTestCampaign: typeof import("./campaigns").sendTestCampaign;

beforeAll(async () => {
  mock.module("@/lib/auth-guard", () => ({
    ...real.guard,
    requireRole: async () => ({
      userId: adminId,
      email: "admin@example.test",
      role: "admin",
    }),
  }));
  mock.module("next/cache", () => ({
    ...real.cache,
    revalidatePath: () => {},
  }));
  mock.module("@/lib/whatsapp/client", () => ({
    ...real.client,
    sendTemplateMessage: async (send: TemplateSend) => {
      messages.push(send);
      return { status: "sent", providerId: "wamid.test" };
    },
  }));
  mock.module("@/emails/send", () => ({
    ...real.send,
    sendEmail: async (email: { to: string; subject: string }) => {
      emails.push({ to: email.to, subject: email.subject });
      return { error: null };
    },
  }));
  mock.module("@/emails/templates/campaign", () => ({
    ...real.email,
    campaignEmail: async (input: {
      content: { subject: string };
      locale: string;
    }) => {
      rendered.push({ locale: input.locale, subject: input.content.subject });
      return { subject: input.content.subject, html: "<p></p>" };
    },
  }));
  mock.module("@/lib/insforge-admin", () => ({
    getAdminClient: () => ({
      database: chainDb(async (table, chain) => {
        const names = chain.map((s) => s.name);
        if (table === "whatsapp_templates") {
          const id = String(
            chain.find((s) => s.name === "eq" && s.args[0] === "id")?.args[1],
          );
          templateReads.push(id);
          return { data: templates[id] ?? null, error: null };
        }
        if (table === "profiles") {
          return { data: { phone: "+34600111222" }, error: null };
        }
        if (names.includes("insert") || names.includes("update")) {
          writes.push(chain.find((s) => s.name === names[0])?.args[0]);
          return { data: { id: "c-1" }, error: null };
        }
        // The name is free.
        return { data: [], count: 0, error: null };
      }).db,
    }),
  }));
  ({ saveCampaign, sendTestWhatsAppCampaign, sendTestCampaign } =
    await import("./campaigns"));
});

afterAll(() => {
  mock.module("@/lib/auth-guard", () => real.guard);
  mock.module("@/lib/insforge-admin", () => real.admin);
  mock.module("next/cache", () => real.cache);
  mock.module("@/lib/whatsapp/client", () => real.client);
  mock.module("@/emails/send", () => real.send);
  mock.module("@/emails/templates/campaign", () => real.email);
});

let seq = 0;
beforeEach(() => {
  templates = { [TPL_ES]: spanish(), [TPL_EN]: english() };
  templateReads = [];
  writes = [];
  messages = [];
  emails = [];
  rendered = [];
  // Each test its own admin: the WhatsApp test is limited per administrator.
  seq += 1;
  adminId = `admin-${seq}`;
});

const empty = { subject: "", preheader: "", title: "", doc: null };
const name = { kind: "field" as const, field: "first_name" as const };
const audience = (language: "any" | "es" | "en" = "any") => ({
  language,
  newsletter: null,
  services: [],
  lastBooking: null,
  neverBooked: false,
  manualIds: [],
});
const whatsapp = (
  block: Record<string, unknown>,
  language: "any" | "es" | "en" = "any",
) => ({
  name: "Reapertura",
  channel: "whatsapp" as const,
  kind: "standard" as const,
  trigger: {},
  audience: audience(language),
  content: { en: empty, es: empty, whatsapp: block } as never,
});
const BOTH = {
  es: { templateId: TPL_ES, params: [name] },
  en: { templateId: TPL_EN, params: [name] },
};

describe("saving a WhatsApp campaign that can go out", () => {
  test("for both languages, with an approved template in each: saved, having checked the two", async () => {
    const out = await saveCampaign("t", whatsapp(BOTH));
    expect(out).toEqual({ ok: true, id: "c-1" });
    expect(templateReads.sort()).toEqual([TPL_ES, TPL_EN].sort());
    // Stored as it was written: a template per language.
    expect(
      (writes[0] as { content: { whatsapp: unknown } }).content.whatsapp,
    ).toEqual(BOTH);
  });

  test("the English template paused since: refused on the English one, nothing written", async () => {
    templates[TPL_EN] = english({ status: "PAUSED" });
    const out = await saveCampaign("t", whatsapp(BOTH));
    expect(out).toEqual({
      ok: false,
      error: "invalid",
      fieldErrors: { "content.whatsapp.en.templateId": "templateUnavailable" },
    });
    expect(writes).toEqual([]);
  });

  test("something wrong in each language: both come back, each on its own", async () => {
    templates[TPL_ES] = spanish({ param_count: 2 });
    templates[TPL_EN] = null;
    const out = await saveCampaign("t", whatsapp(BOTH));
    expect(out).toMatchObject({
      ok: false,
      fieldErrors: {
        "content.whatsapp.es.params": "paramCountMismatch",
        "content.whatsapp.en.templateId": "templateUnavailable",
      },
    });
  });

  test("a Spanish template in the English slot is not a template for English", async () => {
    const out = await saveCampaign(
      "t",
      whatsapp({ ...BOTH, en: { templateId: TPL_ES, params: [name] } }),
    );
    expect(out).toMatchObject({
      ok: false,
      fieldErrors: { "content.whatsapp.en.templateId": "templateUnavailable" },
    });
  });

  test("with no English template at all it never gets to the database: the schema says which is missing", async () => {
    const out = await saveCampaign("t", whatsapp({ es: BOTH.es }));
    expect(out).toMatchObject({
      ok: false,
      fieldErrors: { "content.whatsapp.en.templateId": "templateRequired" },
    });
    expect(templateReads).toEqual([]);
  });

  test("a Spanish audience needs, and reads, only the Spanish one", async () => {
    templates[TPL_EN] = null;
    const out = await saveCampaign("t", whatsapp({ es: BOTH.es }, "es"));
    expect(out).toEqual({ ok: true, id: "c-1" });
    expect(templateReads).toEqual([TPL_ES]);
  });

  test("an appointment notice needs a Utility template in each language", async () => {
    templates[TPL_ES] = spanish({ category: "UTILITY" });
    const out = await saveCampaign("t", {
      ...whatsapp(BOTH),
      kind: "appointment",
      trigger: { event: "before_visit", hours: 24 },
    });
    expect(out).toMatchObject({
      ok: false,
      fieldErrors: {
        "content.whatsapp.en.templateId": "templateCategoryNotAllowed",
      },
    });
  });

  test("a draft is not held to any of it", async () => {
    templates = {};
    const out = await saveCampaign("t", whatsapp({ es: BOTH.es }), {
      draft: true,
    });
    expect(out).toEqual({ ok: true, id: "c-1" });
    expect(templateReads).toEqual([]);
  });

  test("a campaign in the old shape, one template and no language, still saves for the language it had", async () => {
    const out = await saveCampaign(
      "t",
      whatsapp({ templateId: TPL_ES, params: [name] }, "es"),
    );
    expect(out).toEqual({ ok: true, id: "c-1" });
    expect(templateReads).toEqual([TPL_ES]);
  });
});

describe("the WhatsApp test is of the language on screen", () => {
  const content = { en: empty, es: empty, whatsapp: BOTH } as never;

  test("Spanish on screen: the Spanish template, with its own example values", async () => {
    const out = await sendTestWhatsAppCampaign("t", content, audience(), "es");
    expect(out).toEqual({ ok: true, to: "+34600111222" });
    expect(messages).toEqual([
      {
        to: "+34600111222",
        name: "reapertura",
        language: "es",
        bodyParams: ["Ana"],
      },
    ]);
    expect(templateReads).toEqual([TPL_ES]);
  });

  test("English on screen: the English one, and only that one", async () => {
    const quiet = spyOn(console, "info").mockImplementation(() => {});
    const out = await sendTestWhatsAppCampaign("t", content, audience(), "en");
    quiet.mockRestore();
    expect(out).toEqual({ ok: true, to: "+34600111222" });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      name: "reopening",
      language: "en",
      bodyParams: ["Anna"],
    });
    expect(templateReads).toEqual([TPL_EN]);
  });

  test("a language with no template chosen sends nothing and says the template is missing", async () => {
    const out = await sendTestWhatsAppCampaign(
      "t",
      { en: empty, es: empty, whatsapp: { es: BOTH.es } } as never,
      audience(),
      "en",
    );
    expect(out).toEqual({
      ok: false,
      error: "template_unavailable",
      detail: "template_missing",
    });
    expect(messages).toEqual([]);
  });

  test("a language that is neither is refused before anything is read", async () => {
    const out = await sendTestWhatsAppCampaign(
      "t",
      content,
      audience(),
      "fr" as never,
    );
    expect(out).toEqual({ ok: false, error: "invalid" });
    expect(templateReads).toEqual([]);
  });

  test("an old campaign's one template is tested on the language it had", async () => {
    const old = {
      en: empty,
      es: empty,
      whatsapp: { templateId: TPL_ES, params: [name] },
    } as never;
    const out = await sendTestWhatsAppCampaign(
      "t",
      old,
      { ...audience(), sendLocale: "es" },
      "es",
    );
    expect(out).toMatchObject({ ok: true });
    expect(messages[0]).toMatchObject({ name: "reapertura" });
  });
});

describe("the email test is of the language on screen", () => {
  const content = {
    es: { subject: "Hola", preheader: "", title: "Hola", doc: null },
    en: { subject: "Hello", preheader: "", title: "Hello", doc: null },
  };

  test("one email, of that version, to the admin who asked", async () => {
    expect(await sendTestCampaign("t", content, "en")).toEqual({
      ok: true,
      to: "admin@example.test",
    });
    expect(rendered).toEqual([{ locale: "en", subject: "Hello" }]);
    expect(emails).toEqual([
      { to: "admin@example.test", subject: "[PRUEBA] Hello" },
    ]);
  });

  test("the Spanish version when Spanish is on screen", async () => {
    await sendTestCampaign("t", content, "es");
    expect(emails).toEqual([
      { to: "admin@example.test", subject: "[PRUEBA] Hola" },
    ]);
  });

  test("a language that is neither sends nothing", async () => {
    expect(await sendTestCampaign("t", content, "fr" as never)).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(emails).toEqual([]);
  });
});
