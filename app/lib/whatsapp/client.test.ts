import { afterEach, describe, expect, test } from "bun:test";
import {
  buildTemplateBody,
  createRemoteTemplate,
  listRemoteTemplates,
  sendTemplate,
  sendTemplateMessage,
  type CreateTemplateInput,
} from "@/lib/whatsapp/client";

const STAFF_PARAMS = [
  "Yuli",
  "Se te ha asignado una sesión",
  "Ana",
  "Drenaje",
  "lunes, 09:00",
];

const ENV_KEYS = [
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_BUSINESS_ACCOUNT_ID",
  "WHATSAPP_API_VERSION",
  "WHATSAPP_TEMPLATE_NAME",
] as const;

type Env = Partial<Record<(typeof ENV_KEYS)[number], string>>;

const CONFIGURED: Env = {
  WHATSAPP_ACCESS_TOKEN: "secret-token",
  WHATSAPP_PHONE_NUMBER_ID: "111",
  WHATSAPP_BUSINESS_ACCOUNT_ID: "222",
};

/**
 * Runs `fn` with exactly these WhatsApp variables (every other one unset) and
 * puts the real environment back afterwards, even when `fn` throws.
 */
async function withEnv<T>(env: Env, fn: () => Promise<T> | T): Promise<T> {
  const saved: Record<string, string | undefined> = {};
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    const value = env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

type Call = { url: string; init: RequestInit };

/** Replaces fetch with a queue of canned answers and records every call. */
function mockFetch(answers: (Response | Error)[]): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    const next = answers.shift();
    if (!next) throw new Error("unexpected extra request");
    if (next instanceof Error) throw next;
    return next;
  }) as unknown as typeof fetch;
  return calls;
}

/** A fetch that fails the test if anything reaches the network. */
function forbidFetch(): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    throw new Error("the network must not be reached");
  }) as unknown as typeof fetch;
  return calls;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const text = (body: string, status: number) => new Response(body, { status });

describe("buildTemplateBody", () => {
  const base = { to: "+34600112233", name: "hola", language: "es" };

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

  test("refuses a button index that is not a non-negative integer", () => {
    for (const index of [-1, 1.5, Number.NaN]) {
      expect(() =>
        buildTemplateBody({
          ...base,
          bodyParams: [],
          buttonUrlParams: [{ index, text: "x" }],
        }),
      ).toThrow(/Invalid button index/);
    }
  });
});

describe("sending without credentials", () => {
  test("sendTemplate reports skipped and never touches the network", () =>
    withEnv({}, async () => {
      const calls = forbidFetch();
      const result = await sendTemplate({
        to: "+34600112233",
        params: STAFF_PARAMS,
        buttonUrlParam: "booking-id",
      });
      expect(result).toEqual({ status: "skipped" });
      expect(calls).toHaveLength(0);
    }));

  test("sendTemplateMessage skips the same way", () =>
    withEnv({}, async () => {
      const calls = forbidFetch();
      const result = await sendTemplateMessage({
        to: "+34600112233",
        name: "any_template",
        language: "es",
        bodyParams: [],
      });
      expect(result).toEqual({ status: "skipped" });
      expect(calls).toHaveLength(0);
    }));
});

describe("sending", () => {
  const send = {
    to: "+34600112233",
    name: "x",
    language: "es",
    bodyParams: [],
  };

  test("sendTemplate posts the staff template exactly as it always did", () =>
    withEnv(CONFIGURED, async () => {
      const calls = mockFetch([json({ messages: [{ id: "wamid.1" }] })]);

      const result = await sendTemplate({
        to: "+34600112233",
        params: STAFF_PARAMS,
        buttonUrlParam: "booking-id",
      });

      expect(result).toEqual({ status: "sent", providerId: "wamid.1" });
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe(
        "https://graph.facebook.com/v21.0/111/messages",
      );
      expect(calls[0].init.method).toBe("POST");
      expect(calls[0].init.headers).toEqual({
        Authorization: "Bearer secret-token",
        "Content-Type": "application/json",
      });
      // No field beyond what the notification has always sent.
      expect(Object.keys(calls[0].init).sort()).toEqual([
        "body",
        "cache",
        "headers",
        "method",
        "signal",
      ]);
      expect(calls[0].init.body).toBe(
        JSON.stringify({
          messaging_product: "whatsapp",
          to: "+34600112233",
          type: "template",
          template: {
            name: "essentia_booking_update",
            language: { code: "es" },
            components: [
              {
                type: "body",
                parameters: STAFF_PARAMS.map((text) => ({
                  type: "text",
                  text,
                })),
              },
              {
                type: "button",
                sub_type: "url",
                index: "0",
                parameters: [{ type: "text", text: "booking-id" }],
              },
            ],
          },
        }),
      );
    }));

  test("honours the configured API version and template name", () =>
    withEnv(
      {
        ...CONFIGURED,
        WHATSAPP_API_VERSION: "v99.0",
        WHATSAPP_TEMPLATE_NAME: "other",
      },
      async () => {
        const calls = mockFetch([json({ messages: [{ id: "w" }] })]);
        await sendTemplate({
          to: "+34600112233",
          params: [],
          buttonUrlParam: "b",
        });
        expect(calls[0].url).toBe(
          "https://graph.facebook.com/v99.0/111/messages",
        );
        expect(JSON.parse(String(calls[0].init.body)).template.name).toBe(
          "other",
        );
      },
    ));

  test("a refusal comes back as a value, preferring error_data.details", () =>
    withEnv(CONFIGURED, async () => {
      mockFetch([
        json(
          {
            error: {
              message: "generic",
              error_data: { details: "bad number" },
            },
          },
          400,
        ),
      ]);
      expect(await sendTemplateMessage(send)).toEqual({
        status: "failed",
        error: "bad number",
      });
    }));

  test("a refusal without details falls back to message", () =>
    withEnv(CONFIGURED, async () => {
      mockFetch([json({ error: { message: "generic" } }, 400)]);
      expect(await sendTemplateMessage(send)).toEqual({
        status: "failed",
        error: "generic",
      });
    }));

  test("a 5xx with a body that is not JSON reports the status", () =>
    withEnv(CONFIGURED, async () => {
      mockFetch([text("<html>Bad gateway</html>", 502)]);
      expect(await sendTemplateMessage(send)).toEqual({
        status: "failed",
        error: "HTTP 502",
        ambiguous: true,
      });
    }));

  test("a 200 with malformed JSON is still sent, without an id", () =>
    withEnv(CONFIGURED, async () => {
      mockFetch([text("{not json", 200)]);
      expect(await sendTemplateMessage(send)).toEqual({
        status: "sent",
        providerId: null,
      });
    }));

  test("a network failure comes back as failed, not as a throw", () =>
    withEnv(CONFIGURED, async () => {
      mockFetch([new Error("socket hang up")]);
      expect(await sendTemplateMessage(send)).toEqual({
        status: "failed",
        error: "socket hang up",
        ambiguous: true,
      });
    }));

  test("a timeout comes back as failed, not as a throw", () =>
    withEnv(CONFIGURED, async () => {
      mockFetch([new DOMException("The operation timed out.", "TimeoutError")]);
      expect(await sendTemplateMessage(send)).toEqual({
        status: "failed",
        error: "The operation timed out.",
        ambiguous: true,
      });
    }));

  test("an invalid button index fails the send before any request", () =>
    withEnv(CONFIGURED, async () => {
      const calls = forbidFetch();
      const result = await sendTemplateMessage({
        ...send,
        buttonUrlParams: [{ index: -1, text: "x" }],
      });
      expect(result.status).toBe("failed");
      // Nothing left the process, so it is not a doubt about delivery.
      expect(result).not.toHaveProperty("ambiguous");
      expect(calls).toHaveLength(0);
    }));

  test("a 5xx carrying Meta's error body is still ambiguous", () =>
    withEnv(CONFIGURED, async () => {
      mockFetch([json({ error: { message: "Service unavailable" } }, 503)]);
      expect(await sendTemplateMessage(send)).toEqual({
        status: "failed",
        error: "Service unavailable",
        ambiguous: true,
      });
    }));

  test("a 4xx refusal is definitive: no ambiguous flag at all", () =>
    withEnv(CONFIGURED, async () => {
      mockFetch([
        json({ error: { message: "Template not found", code: 132001 } }, 404),
      ]);
      const result = await sendTemplateMessage(send);
      expect(result).toEqual({ status: "failed", error: "Template not found" });
      expect(result).not.toHaveProperty("ambiguous");
    }));

  test("a 4xx whose body is not JSON is still a refusal", () =>
    withEnv(CONFIGURED, async () => {
      mockFetch([text("Bad request", 400)]);
      const result = await sendTemplateMessage(send);
      expect(result).toEqual({ status: "failed", error: "HTTP 400" });
      expect(result).not.toHaveProperty("ambiguous");
    }));

  test("sent and skipped results never carry the flag", () =>
    withEnv(CONFIGURED, async () => {
      mockFetch([json({ messages: [{ id: "wamid.9" }] })]);
      expect(await sendTemplateMessage(send)).not.toHaveProperty("ambiguous");
    }));
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

describe("listRemoteTemplates", () => {
  test("throws before any request when the API is not configured", () =>
    withEnv({ WHATSAPP_ACCESS_TOKEN: "secret-token" }, async () => {
      const calls = forbidFetch();
      await expect(listRemoteTemplates()).rejects.toThrow(
        "WhatsApp template API is not configured",
      );
      expect(calls).toHaveLength(0);
    }));

  test("sends the bearer token to the account's templates endpoint", () =>
    withEnv(CONFIGURED, async () => {
      const calls = mockFetch([json({ data: [] })]);
      await listRemoteTemplates();
      expect(calls[0].url).toStartWith(
        "https://graph.facebook.com/v21.0/222/message_templates?fields=",
      );
      expect(calls[0].init.headers).toEqual({
        Authorization: "Bearer secret-token",
      });
      expect(calls[0].init.redirect).toBe("error");
    }));

  test("follows Meta's pagination and flattens", () =>
    withEnv(CONFIGURED, async () => {
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
      expect(calls[1].init.headers).toEqual({
        Authorization: "Bearer secret-token",
      });
    }));

  test("keeps URL and quick-reply buttons in our shape and reports the rest", () =>
    withEnv(CONFIGURED, async () => {
      mockFetch([
        json({
          data: [
            {
              ...remote("1"),
              components: [
                { type: "HEADER", format: "IMAGE" },
                { type: "BODY", text: "Hola {{1}}" },
                {
                  type: "BUTTONS",
                  buttons: [
                    { type: "URL", text: "Ver", url: "https://essentia.es/a" },
                    { type: "QUICK_REPLY", text: "Gracias" },
                    {
                      type: "PHONE_NUMBER",
                      text: "Llamar",
                      phone_number: "+34",
                    },
                    { type: "COPY_CODE", text: "Copiar" },
                    { type: "URL", text: "Sin url" },
                  ],
                },
              ],
            },
          ],
        }),
      ]);
      const [t] = await listRemoteTemplates();
      expect(t.buttons).toEqual([
        { type: "URL", text: "Ver", url: "https://essentia.es/a" },
        { type: "QUICK_REPLY", text: "Gracias" },
      ]);
      expect(t.unsupportedButtons).toEqual([
        "PHONE_NUMBER",
        "COPY_CODE",
        "URL",
      ]);
      expect(t.headerFormat).toBe("IMAGE");
      expect(t.headerText).toBeNull();
    }));

  test("a text header reports its format and text", () =>
    withEnv(CONFIGURED, async () => {
      mockFetch([
        json({
          data: [
            {
              ...remote("1"),
              components: [
                { type: "HEADER", format: "TEXT", text: "Tu cita" },
                { type: "BODY", text: "Hola" },
              ],
            },
          ],
        }),
      ]);
      const [t] = await listRemoteTemplates();
      expect(t.headerFormat).toBe("TEXT");
      expect(t.headerText).toBe("Tu cita");
      expect(t.unsupportedButtons).toEqual([]);
    }));

  test("refuses a next page on another host and never sends the token there", () =>
    withEnv(CONFIGURED, async () => {
      const calls = mockFetch([
        json({
          data: [remote("1")],
          paging: { next: "https://evil.example.com/steal?x=1" },
        }),
      ]);
      await expect(listRemoteTemplates()).rejects.toThrow(/unexpected host/);
      expect(calls).toHaveLength(1);
    }));

  test("refuses a look-alike host, plain http and a broken URL", () =>
    withEnv(CONFIGURED, async () => {
      const cases: [string, RegExp][] = [
        ["https://graph.facebook.com.evil.example/x", /unexpected host/],
        ["http://graph.facebook.com/x", /unexpected host/],
        ["https://user@evil.example/x", /unexpected host/],
        ["http://", /invalid pagination URL/],
      ];
      for (const [next, message] of cases) {
        const calls = mockFetch([json({ data: [], paging: { next } })]);
        await expect(listRemoteTemplates()).rejects.toThrow(message);
        expect(calls).toHaveLength(1);
      }
    }));

  test("stops when Meta repeats a page", () =>
    withEnv(CONFIGURED, async () => {
      const next =
        "https://graph.facebook.com/v21.0/222/message_templates?after=same";
      globalThis.fetch = (async () =>
        json({
          data: [remote("1")],
          paging: { next },
        })) as unknown as typeof fetch;
      await expect(listRemoteTemplates()).rejects.toThrow(
        /same templates page/,
      );
    }));

  test("stops after 50 pages even if every page is new", () =>
    withEnv(CONFIGURED, async () => {
      let calls = 0;
      globalThis.fetch = (async () => {
        calls += 1;
        return json({
          data: [],
          paging: {
            next: `https://graph.facebook.com/v21.0/222/message_templates?after=${calls}`,
          },
        });
      }) as unknown as typeof fetch;
      await expect(listRemoteTemplates()).rejects.toThrow(/more than 50 pages/);
      expect(calls).toBe(50);
    }));

  test("tolerates a page without data and a template without components", () =>
    withEnv(CONFIGURED, async () => {
      const next =
        "https://graph.facebook.com/v21.0/222/message_templates?after=2";
      mockFetch([
        json({ paging: { next } }),
        json({
          data: [
            {
              id: "9",
              name: "odd",
              language: "es",
              category: "X",
              status: "PENDING",
            },
          ],
        }),
      ]);
      const list = await listRemoteTemplates();
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({
        metaId: "9",
        body: "",
        buttons: [],
        headerFormat: null,
      });
    }));

  test("explains an API error with Meta's most specific message", () =>
    withEnv(CONFIGURED, async () => {
      mockFetch([
        json(
          {
            error: {
              message: "generic",
              error_user_msg: "For people",
              error_data: { details: "For logs" },
            },
          },
          400,
        ),
        json(
          {
            error: { message: "generic", error_data: { details: "For logs" } },
          },
          400,
        ),
        json({ error: { message: "Invalid token" } }, 401),
      ]);
      await expect(listRemoteTemplates()).rejects.toThrow("For people");
      await expect(listRemoteTemplates()).rejects.toThrow("For logs");
      await expect(listRemoteTemplates()).rejects.toThrow("Invalid token");
    }));

  test("reports the status when the error body is not JSON", () =>
    withEnv(CONFIGURED, async () => {
      mockFetch([text("<html>Bad gateway</html>", 502)]);
      await expect(listRemoteTemplates()).rejects.toThrow("Meta 502");
    }));

  test("reports a 200 whose body is malformed", () =>
    withEnv(CONFIGURED, async () => {
      mockFetch([text("{not json", 200)]);
      await expect(listRemoteTemplates()).rejects.toThrow(
        "Meta returned an unreadable response",
      );
    }));

  test("wraps a network failure and a timeout in a readable error", () =>
    withEnv(CONFIGURED, async () => {
      mockFetch([
        new Error("socket hang up"),
        new DOMException("The operation timed out.", "TimeoutError"),
      ]);
      await expect(listRemoteTemplates()).rejects.toThrow(
        "Could not reach WhatsApp: socket hang up",
      );
      await expect(listRemoteTemplates()).rejects.toThrow(
        "Could not reach WhatsApp: The operation timed out.",
      );
    }));
});

describe("createRemoteTemplate", () => {
  const input: CreateTemplateInput = {
    name: "promo",
    language: "es",
    category: "UTILITY",
    body: "Hola",
    buttons: [],
    exampleParams: [],
  };

  const sentComponents = (call: Call) =>
    JSON.parse(String(call.init.body)).components as Record<string, unknown>[];

  test("throws before any request when the API is not configured", () =>
    withEnv({ WHATSAPP_BUSINESS_ACCOUNT_ID: "222" }, async () => {
      const calls = forbidFetch();
      await expect(createRemoteTemplate(input)).rejects.toThrow(
        "WhatsApp template API is not configured",
      );
      expect(calls).toHaveLength(0);
    }));

  test("submits the components Meta expects, with the bearer token", () =>
    withEnv(CONFIGURED, async () => {
      const calls = mockFetch([json({ id: "999", status: "PENDING" })]);

      const result = await createRemoteTemplate({
        ...input,
        category: "MARKETING",
        headerText: "Hola",
        body: "Hola {{1}}",
        footerText: "Responde BAJA",
        buttons: [{ type: "QUICK_REPLY", text: "Baja" }],
        exampleParams: ["Ana"],
      });

      expect(result).toEqual({ id: "999", status: "PENDING" });
      expect(calls[0].url).toBe(
        "https://graph.facebook.com/v21.0/222/message_templates",
      );
      expect(calls[0].init.method).toBe("POST");
      expect(calls[0].init.headers).toEqual({
        Authorization: "Bearer secret-token",
        "Content-Type": "application/json",
      });
      expect(calls[0].init.redirect).toBe("error");
      const components = sentComponents(calls[0]);
      expect(components.map((c) => c.type)).toEqual([
        "HEADER",
        "BODY",
        "FOOTER",
        "BUTTONS",
      ]);
      expect(components[1].example).toEqual({ body_text: [["Ana"]] });
      expect(components[3].buttons).toEqual([
        { type: "QUICK_REPLY", text: "Baja" },
      ]);
    }));

  test("a dynamic URL button carries an example of its URL", () =>
    withEnv(CONFIGURED, async () => {
      const calls = mockFetch([
        json({ id: "1" }),
        json({ id: "2" }),
        json({ id: "3" }),
      ]);
      const button = { type: "URL" as const, text: "Ver" };

      await createRemoteTemplate({
        ...input,
        buttons: [{ ...button, url: "https://x.test/{{1}}" }],
      });
      await createRemoteTemplate({
        ...input,
        buttons: [
          { ...button, url: "https://x.test/{{1}}", example: "cita-42" },
        ],
      });
      await createRemoteTemplate({
        ...input,
        buttons: [{ ...button, url: "https://x.test/pago" }],
      });

      const buttons = calls.map((c) => sentComponents(c)[1].buttons);
      expect(buttons[0]).toEqual([
        {
          type: "URL",
          text: "Ver",
          url: "https://x.test/{{1}}",
          example: ["https://x.test/ejemplo"],
        },
      ]);
      expect(buttons[1]).toEqual([
        {
          type: "URL",
          text: "Ver",
          url: "https://x.test/{{1}}",
          example: ["https://x.test/cita-42"],
        },
      ]);
      // A static URL has nothing to exemplify.
      expect(buttons[2]).toEqual([
        { type: "URL", text: "Ver", url: "https://x.test/pago" },
      ]);
    }));

  test("surfaces Meta's most specific message on failure", () =>
    withEnv(CONFIGURED, async () => {
      mockFetch([
        json(
          {
            error: {
              message: "generic",
              error_user_msg: "Name taken",
              error_data: { details: "For logs" },
            },
          },
          400,
        ),
        json(
          { error: { message: "generic", error_data: { details: "Bad" } } },
          400,
        ),
      ]);
      await expect(createRemoteTemplate(input)).rejects.toThrow("Name taken");
      await expect(createRemoteTemplate(input)).rejects.toThrow("Bad");
    }));

  test("reports the status when the error body is not JSON", () =>
    withEnv(CONFIGURED, async () => {
      mockFetch([text("<html>Bad gateway</html>", 502)]);
      await expect(createRemoteTemplate(input)).rejects.toThrow("Meta 502");
    }));

  test("a 200 without an id says so instead of blaming a status", () =>
    withEnv(CONFIGURED, async () => {
      mockFetch([json({ status: "PENDING" }), text("{not json", 200)]);
      const message = "Meta accepted the template but returned no id for it";
      await expect(createRemoteTemplate(input)).rejects.toThrow(message);
      await expect(createRemoteTemplate(input)).rejects.toThrow(message);
    }));

  test("wraps a network failure in a readable error", () =>
    withEnv(CONFIGURED, async () => {
      mockFetch([new Error("socket hang up")]);
      await expect(createRemoteTemplate(input)).rejects.toThrow(
        "Could not reach WhatsApp: socket hang up",
      );
    }));
});
