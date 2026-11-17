import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  buildTemplateBody,
  createRemoteTemplate,
  listRemoteTemplates,
  sendTemplate,
  sendTemplateMessage,
} from "@/lib/whatsapp/client";

const STAFF_PARAMS = [
  "Yuli",
  "Se te ha asignado una sesión",
  "Ana",
  "Drenaje",
  "lunes, 09:00",
];

describe("buildTemplateBody", () => {
  test("keeps the shape the staff notification has always sent", () => {
    const body = buildTemplateBody({
      to: "+34600112233",
      name: "essentia_booking_update",
      language: "es",
      bodyParams: STAFF_PARAMS,
      buttonUrlParams: [{ index: 0, text: "booking-id" }],
    });
    expect(body).toEqual({
      messaging_product: "whatsapp",
      to: "+34600112233",
      type: "template",
      template: {
        name: "essentia_booking_update",
        language: { code: "es" },
        components: [
          {
            type: "body",
            parameters: STAFF_PARAMS.map((text) => ({ type: "text", text })),
          },
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [{ type: "text", text: "booking-id" }],
          },
        ],
      },
    });
  });
});

describe("buildTemplateBody components", () => {
  const base = { to: "+34600112233", name: "hola", language: "es" };

  test("a template without parameters sends no body component", () => {
    const body = buildTemplateBody({ ...base, bodyParams: [] });
    expect(body.template.components).toEqual([]);
  });

  test("without buttonUrlParams no button is sent", () => {
    const body = buildTemplateBody({ ...base, bodyParams: ["a"] });
    expect(body.template.components).toEqual([
      { type: "body", parameters: [{ type: "text", text: "a" }] },
    ]);
  });

  test("several URL buttons keep their own index", () => {
    const body = buildTemplateBody({
      ...base,
      bodyParams: [],
      buttonUrlParams: [
        { index: 0, text: "one" },
        { index: 2, text: "three" },
      ],
    });
    expect(body.template.components).toEqual([
      {
        type: "button",
        sub_type: "url",
        index: "0",
        parameters: [{ type: "text", text: "one" }],
      },
      {
        type: "button",
        sub_type: "url",
        index: "2",
        parameters: [{ type: "text", text: "three" }],
      },
    ]);
  });
});

describe("sendTemplate without credentials", () => {
  const KEYS = ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"] as const;
  const saved: Record<string, string | undefined> = {};
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    for (const key of KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    globalThis.fetch = realFetch;
  });

  test("reports skipped and never touches the network", async () => {
    let calls = 0;
    globalThis.fetch = (() => {
      calls += 1;
      throw new Error("the network must not be reached");
    }) as unknown as typeof fetch;

    const result = await sendTemplate({
      to: "+34600112233",
      params: STAFF_PARAMS,
      buttonUrlParam: "booking-id",
    });

    expect(result).toEqual({ status: "skipped" });
    expect(calls).toBe(0);
  });

  test("sendTemplateMessage skips the same way", async () => {
    let calls = 0;
    globalThis.fetch = (() => {
      calls += 1;
      throw new Error("the network must not be reached");
    }) as unknown as typeof fetch;

    const result = await sendTemplateMessage({
      to: "+34600112233",
      name: "any_template",
      language: "es",
      bodyParams: [],
    });

    expect(result).toEqual({ status: "skipped" });
    expect(calls).toBe(0);
  });
});

const ENV_KEYS = [
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_BUSINESS_ACCOUNT_ID",
  "WHATSAPP_API_VERSION",
  "WHATSAPP_TEMPLATE_NAME",
] as const;

type Call = { url: string; init: RequestInit };

/** Replaces fetch with a queue of canned answers and records every call. */
function mockFetch(answers: Response[]): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    const next = answers.shift();
    if (!next) throw new Error("unexpected extra request");
    return next;
  }) as unknown as typeof fetch;
  return calls;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("with mocked Meta", () => {
  const saved: Record<string, string | undefined> = {};
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    process.env.WHATSAPP_ACCESS_TOKEN = "secret-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "111";
    process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = "222";
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    globalThis.fetch = realFetch;
  });

  test("sendTemplate posts the staff template with its one button", async () => {
    const calls = mockFetch([json({ messages: [{ id: "wamid.1" }] })]);

    const result = await sendTemplate({
      to: "+34600112233",
      params: STAFF_PARAMS,
      buttonUrlParam: "booking-id",
    });

    expect(result).toEqual({ status: "sent", providerId: "wamid.1" });
    expect(calls[0].url).toBe("https://graph.facebook.com/v21.0/111/messages");
    const sent = JSON.parse(String(calls[0].init.body));
    expect(sent.template.name).toBe("essentia_booking_update");
    expect(sent.template.language).toEqual({ code: "es" });
    expect(sent.template.components).toHaveLength(2);
  });

  test("a refusal comes back as a value, never as a throw", async () => {
    mockFetch([json({ error: { message: "bad number" } }, 400)]);
    const result = await sendTemplateMessage({
      to: "+34600112233",
      name: "x",
      language: "es",
      bodyParams: [],
    });
    expect(result).toEqual({ status: "failed", error: "bad number" });
  });

  const remote = (id: string) => ({
    id,
    name: `t_${id}`,
    language: "es",
    category: "UTILITY",
    status: "APPROVED",
    components: [
      { type: "BODY", text: "Hola {{1}}", example: { body_text: [["Ana"]] } },
    ],
  });

  test("listRemoteTemplates follows Meta's pagination and flattens", async () => {
    const next =
      "https://graph.facebook.com/v21.0/222/message_templates?after=abc";
    const calls = mockFetch([
      json({ data: [remote("1")], paging: { next } }),
      json({ data: [remote("2")] }),
    ]);

    const list = await listRemoteTemplates();

    expect(list.map((t) => t.metaId)).toEqual(["1", "2"]);
    expect(list[0].body).toBe("Hola {{1}}");
    expect(list[0].exampleParams).toEqual(["Ana"]);
    expect(calls[1].url).toBe(next);
  });

  test("listRemoteTemplates refuses a next page on another host", async () => {
    const calls = mockFetch([
      json({
        data: [remote("1")],
        paging: { next: "https://evil.example.com/steal?x=1" },
      }),
    ]);

    await expect(listRemoteTemplates()).rejects.toThrow(/unexpected host/);
    // The token only ever went to the first, trusted request.
    expect(calls).toHaveLength(1);
  });

  test("listRemoteTemplates refuses a look-alike host and plain http", async () => {
    for (const next of [
      "https://graph.facebook.com.evil.example/x",
      "http://graph.facebook.com/x",
      "not a url",
    ]) {
      const calls = mockFetch([json({ data: [], paging: { next } })]);
      await expect(listRemoteTemplates()).rejects.toThrow();
      expect(calls).toHaveLength(1);
    }
  });

  test("listRemoteTemplates throws on an API error", async () => {
    mockFetch([json({ error: {} }, 401)]);
    await expect(listRemoteTemplates()).rejects.toThrow("Meta 401");
  });

  test("createRemoteTemplate submits the components Meta expects", async () => {
    const calls = mockFetch([json({ id: "999", status: "PENDING" })]);

    const result = await createRemoteTemplate({
      name: "promo",
      language: "es",
      category: "MARKETING",
      headerText: "Hola",
      body: "Hola {{1}}",
      footerText: "Responde BAJA",
      buttons: [{ type: "URL", text: "Ver", url: "https://x.test/{{1}}" }],
      exampleParams: ["Ana"],
    });

    expect(result).toEqual({ id: "999", status: "PENDING" });
    expect(calls[0].url).toBe(
      "https://graph.facebook.com/v21.0/222/message_templates",
    );
    const sent = JSON.parse(String(calls[0].init.body));
    expect(sent.components.map((c: { type: string }) => c.type)).toEqual([
      "HEADER",
      "BODY",
      "FOOTER",
      "BUTTONS",
    ]);
    expect(sent.components[1].example).toEqual({ body_text: [["Ana"]] });
  });

  test("createRemoteTemplate surfaces Meta's user message on failure", async () => {
    mockFetch([
      json(
        { error: { message: "generic", error_user_msg: "Name taken" } },
        400,
      ),
    ]);
    await expect(
      createRemoteTemplate({
        name: "promo",
        language: "es",
        category: "UTILITY",
        body: "Hola",
        buttons: [],
        exampleParams: [],
      }),
    ).rejects.toThrow("Name taken");
  });
});
