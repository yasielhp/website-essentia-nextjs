import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { buildTemplateBody, sendTemplate } from "@/lib/whatsapp/client";

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
});
