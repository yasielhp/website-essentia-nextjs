import { describe, expect, test } from "bun:test";
import { validateCampaign, validateCampaignDraft } from "@/lib/schemas";

/**
 * The payload `saveCampaign` validates, field by field. The action once left
 * `kind` and `trigger` out, so every save failed with two errors no step shows.
 */
const audience = {
  language: "any" as const,
  newsletter: null,
  services: [],
  lastBooking: null,
  neverBooked: false,
  sendLocale: "es" as const,
  manualIds: [],
};

const empty = { subject: "", preheader: "", title: "", doc: null };
const filled = {
  subject: "Algo bonito está tomando forma en Essentia",
  preheader: "Un lugar para volver a ti.",
  title: "Un lugar para volver a ti.",
  doc: {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Hola." }] },
    ],
  },
};

const campaign = {
  name: "Reapertura",
  kind: "standard" as const,
  trigger: {},
  audience,
  content: { en: empty, es: filled },
};

describe("validateCampaign", () => {
  test("a standard campaign written in the send language passes", () => {
    expect(validateCampaign(campaign)).toEqual({
      ok: true,
      data: { ...campaign, channel: "email" },
    });
  });

  test("kind and trigger are part of the payload, not optional", () => {
    const withoutKind: Partial<typeof campaign> = { ...campaign };
    delete withoutKind.kind;
    delete withoutKind.trigger;
    const result = validateCampaign(withoutKind);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(["kind", "trigger"]);
    }
  });

  test("the send language cannot be left empty", () => {
    const result = validateCampaign({
      ...campaign,
      content: { en: empty, es: empty },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors["content.es.subject"]).toBe("subjectRequired");
    }
  });

  test("a draft needs only a name and well-formed fields", () => {
    expect(
      validateCampaignDraft({
        ...campaign,
        content: { en: empty, es: empty },
      }).ok,
    ).toBe(true);
  });
});

describe("a WhatsApp campaign", () => {
  const whatsapp = {
    ...campaign,
    channel: "whatsapp" as const,
    content: {
      en: empty,
      es: empty,
      whatsapp: {
        templateId: "6f1c2a3e-1111-4222-8333-444455556666",
        params: [{ kind: "field" as const, field: "first_name" as const }],
      },
    },
  };

  test("needs a template and nothing in the email blocks", () => {
    expect(validateCampaign(whatsapp).ok).toBe(true);
  });

  test("refuses an empty template", () => {
    const r = validateCampaign({
      ...whatsapp,
      content: {
        ...whatsapp.content,
        whatsapp: { templateId: null, params: [] },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.errors["content.whatsapp.templateId"]).toBe("templateRequired");
  });

  test("refuses a campaign with no whatsapp block at all", () => {
    const r = validateCampaign({
      ...whatsapp,
      content: { en: empty, es: empty },
    });
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.errors["content.whatsapp.templateId"]).toBe("templateRequired");
  });

  test("keeps the whatsapp block in the validated data", () => {
    const r = validateCampaign(whatsapp);
    expect(r.ok).toBe(true);
    if (r.ok)
      expect(r.data.content.whatsapp).toEqual(whatsapp.content.whatsapp);
  });

  test("a fixed text over 200 characters is too long", () => {
    const r = validateCampaign({
      ...whatsapp,
      content: {
        ...whatsapp.content,
        whatsapp: {
          templateId: whatsapp.content.whatsapp.templateId,
          params: [{ kind: "static", value: "x".repeat(201) }],
        },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.errors["content.whatsapp.params.0"]).toBe("paramTooLong");
  });

  test("a parameter that reads an unknown field is refused", () => {
    const r = validateCampaign({
      ...whatsapp,
      content: {
        ...whatsapp.content,
        whatsapp: {
          templateId: whatsapp.content.whatsapp.templateId,
          params: [{ kind: "field", field: "shoe_size" }],
        },
      },
    });
    expect(r.ok).toBe(false);
  });

  test("an email campaign ignores the whatsapp block", () => {
    expect(
      validateCampaign({
        ...campaign,
        channel: "email",
        content: {
          ...campaign.content,
          whatsapp: { templateId: null, params: [] },
        },
      }).ok,
    ).toBe(true);
    expect(validateCampaign({ ...campaign, channel: "email" }).ok).toBe(true);
  });

  test("an unknown channel is refused", () => {
    expect(validateCampaign({ ...campaign, channel: "sms" }).ok).toBe(false);
  });

  test("a draft needs nothing from the template", () => {
    const r = validateCampaignDraft({
      ...whatsapp,
      content: {
        en: empty,
        es: empty,
        whatsapp: { templateId: null, params: [] },
      },
    });
    expect(r.ok).toBe(true);
  });

  test("a draft still refuses a template id that is not a uuid", () => {
    const r = validateCampaignDraft({
      ...whatsapp,
      content: {
        ...whatsapp.content,
        whatsapp: { templateId: "not-a-uuid", params: [] },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.errors["content.whatsapp.templateId"]).toBe("templateRequired");
  });

  test("a draft still refuses a malformed parameter", () => {
    const r = validateCampaignDraft({
      ...whatsapp,
      content: {
        ...whatsapp.content,
        whatsapp: {
          templateId: null,
          params: [{ kind: "static", value: "x".repeat(201) }],
        },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.errors["content.whatsapp.params.0"]).toBe("paramTooLong");
  });

  test("a draft keeps the whatsapp block", () => {
    const r = validateCampaignDraft(whatsapp);
    expect(r.ok).toBe(true);
    if (r.ok)
      expect(r.data.content.whatsapp).toEqual(whatsapp.content.whatsapp);
  });
});

describe("the channel default", () => {
  test("a payload without channel is an email campaign", () => {
    const r = validateCampaign(campaign);
    expect(r.ok && r.data.channel).toBe("email");
    const d = validateCampaignDraft(campaign);
    expect(d.ok && d.data.channel).toBe("email");
  });
});
