import { describe, expect, test } from "bun:test";
import {
  channelChangeAllowed,
  validateCampaign,
  validateCampaignDraft,
} from "@/lib/schemas";
import { missingLocales } from "./languages";

/**
 * The payload `saveCampaign` validates, field by field. The action once left
 * `kind` and `trigger` out, so every save failed with two errors no step shows.
 */
// A Spanish segment: the campaign is written in Spanish and nothing else.
const audience = {
  language: "es" as const,
  newsletter: null,
  services: [],
  lastBooking: null,
  neverBooked: false,
  manualIds: [],
};
/** An audience that spans both languages: both versions are owed. */
const everyone = { ...audience, language: "any" as const };

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

const filledEn = {
  subject: "Something beautiful is taking shape at Essentia",
  preheader: "A place to come back to yourself.",
  title: "A place to come back to yourself.",
  doc: {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Hello." }] },
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
  test("a campaign for a Spanish audience needs the Spanish version and no other", () => {
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

  test("the language of the audience cannot be left empty", () => {
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

  test("an email campaign needs no template, but a malformed whatsapp block still rejects it", () => {
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
    // Ignored for what it asks (a template), not for its shape.
    expect(
      validateCampaign({
        ...campaign,
        channel: "email",
        content: {
          ...campaign.content,
          whatsapp: { templateId: "not-a-uuid", params: [] },
        },
      }).ok,
    ).toBe(false);
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

describe("a campaign is written in every language its audience includes", () => {
  const bilingual = {
    ...campaign,
    audience: everyone,
    content: { en: filledEn, es: filled },
  };

  test("an audience of both languages with both versions passes", () => {
    expect(validateCampaign(bilingual).ok).toBe(true);
  });

  test("without the English version it is refused, on the English fields", () => {
    const r = validateCampaign({
      ...bilingual,
      content: { en: empty, es: filled },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toEqual({
        "content.en.subject": "subjectRequired",
        "content.en.title": "titleRequired",
        "content.en.doc": "bodyRequired",
      });
      expect(missingLocales(r.errors)).toEqual(["en"]);
    }
  });

  test("without the Spanish version, on the Spanish ones", () => {
    const r = validateCampaign({
      ...bilingual,
      content: { en: filledEn, es: empty },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(missingLocales(r.errors)).toEqual(["es"]);
  });

  test("a version half written is as missing as one not begun", () => {
    const r = validateCampaign({
      ...bilingual,
      content: { en: { ...empty, subject: "Only a subject" }, es: filled },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors["content.en.title"]).toBe("titleRequired");
      expect(r.errors["content.en.subject"]).toBeUndefined();
    }
  });

  test("an English audience needs only the English version", () => {
    expect(
      validateCampaign({
        ...campaign,
        audience: { ...audience, language: "en" },
        content: { en: filledEn, es: empty },
      }).ok,
    ).toBe(true);
  });

  test("the version nobody will receive may stay half written: it is not sent", () => {
    // Begun while the audience was everybody, then narrowed to Spanish. The
    // tab is gone from the form; an error there would be one nobody can fix.
    expect(
      validateCampaign({
        ...campaign,
        content: { en: { ...empty, subject: "Only a subject" }, es: filled },
      }).ok,
    ).toBe(true);
  });

  test("but its fields keep their limits", () => {
    const r = validateCampaign({
      ...campaign,
      content: { en: { ...empty, subject: "x".repeat(121) }, es: filled },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors["content.en.subject"]).toBe("subjectTooLong");
  });

  test("a draft may have one version half written", () => {
    expect(
      validateCampaignDraft({
        ...bilingual,
        content: { en: { ...empty, subject: "Only a subject" }, es: filled },
      }).ok,
    ).toBe(true);
  });

  test("the send language an older form chose is accepted and decides nothing", () => {
    const r = validateCampaign({
      ...bilingual,
      audience: { ...everyone, sendLocale: "es" as const },
      content: { en: empty, es: filled },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(missingLocales(r.errors)).toEqual(["en"]);
  });

  test("an A/B test has its two subjects in each language", () => {
    const r = validateCampaign({ ...bilingual, kind: "split" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toEqual({
        "content.es.subjectB": "subjectBRequired",
        "content.en.subjectB": "subjectBRequired",
      });
    }
    expect(
      validateCampaign({
        ...bilingual,
        kind: "split",
        content: {
          en: { ...filledEn, subjectB: "Another way to say it" },
          es: { ...filled, subjectB: "Otra forma de decirlo" },
        },
      }).ok,
    ).toBe(true);
  });

  test("the automated kinds are held to the same: each recipient in her language", () => {
    for (const [kind, event] of [
      ["automated", "segment_entry"],
      ["autoresponder", "newsletter_subscribed"],
      ["rss", "new_blog_post"],
      ["dateBased", "birthday"],
    ] as const) {
      const base = { ...bilingual, kind, trigger: { event } };
      expect(validateCampaign(base).ok).toBe(true);
      const r = validateCampaign({
        ...base,
        content: { en: empty, es: filled },
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(missingLocales(r.errors)).toEqual(["en"]);
    }
  });
});

describe("the email rules, now checked by the campaign schema", () => {
  test("a split test without a second subject is refused", () => {
    const r = validateCampaign({ ...campaign, kind: "split" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors["content.es.subjectB"]).toBe("subjectBRequired");
  });

  test("a WhatsApp campaign is not held to the email blocks", () => {
    const r = validateCampaign({
      ...campaign,
      channel: "whatsapp",
      // A half-written email block left from before the channel was switched.
      kind: "standard",
      content: {
        en: { ...empty, subject: "Left over" },
        es: empty,
        whatsapp: {
          templateId: "6f1c2a3e-1111-4222-8333-444455556666",
          params: [],
        },
      },
    });
    expect(r.ok).toBe(true);
  });
});

describe("channelChangeAllowed", () => {
  test("a saved campaign keeps its channel", () => {
    expect(channelChangeAllowed("email", "email")).toBe(true);
    expect(channelChangeAllowed("whatsapp", "whatsapp")).toBe(true);
    expect(channelChangeAllowed("email", "whatsapp")).toBe(false);
    expect(channelChangeAllowed("whatsapp", "email")).toBe(false);
  });
});

describe("the kinds a channel allows", () => {
  const whatsappContent = {
    en: empty,
    es: empty,
    whatsapp: {
      templateId: "6f1c2a3e-1111-4222-8333-444455556666",
      params: [{ kind: "field" as const, field: "first_name" as const }],
    },
  };
  const asWhatsApp = (kind: string) => ({
    ...campaign,
    kind,
    channel: "whatsapp" as const,
    content: whatsappContent,
  });

  test("an email can be an A/B test or an RSS campaign", () => {
    for (const kind of ["split", "rss"]) {
      const email = {
        ...campaign,
        kind,
        content: {
          en: empty,
          es: { ...filled, subjectB: "Otro asunto" },
        },
      };
      expect(validateCampaign(email).ok).toBe(true);
      expect(validateCampaignDraft(email).ok).toBe(true);
    }
  });

  test("a WhatsApp campaign cannot be one, though the browser says it can", () => {
    for (const kind of ["split", "rss"]) {
      for (const validate of [validateCampaign, validateCampaignDraft]) {
        const r = validate(asWhatsApp(kind));
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.errors.kind).toBe("kindNotAllowedForChannel");
      }
    }
  });

  test("the other kinds work on WhatsApp", () => {
    for (const kind of [
      "standard",
      "automated",
      "autoresponder",
      "dateBased",
    ]) {
      expect(validateCampaign(asWhatsApp(kind)).ok).toBe(true);
      expect(validateCampaignDraft(asWhatsApp(kind)).ok).toBe(true);
    }
  });

  test("a kind refused for the channel does not hide the template error", () => {
    const r = validateCampaign({
      ...asWhatsApp("split"),
      content: { en: empty, es: empty },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.kind).toBe("kindNotAllowedForChannel");
      expect(r.errors["content.whatsapp.templateId"]).toBe("templateRequired");
    }
  });
});

describe("a campaign over a hand-made list", () => {
  const ID = "6f1c2a3e-1111-4222-8333-444455556661";
  const list = { ...audience, manualIds: [ID], manualOnly: true };

  test("an email campaign may be aimed at a list", () => {
    expect(validateCampaign({ ...campaign, audience: list }).ok).toBe(true);
  });
  test("a list with nobody in it is refused: it would reach nobody", () => {
    const out = validateCampaign({
      ...campaign,
      audience: { ...audience, manualOnly: true },
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.errors["audience.manualIds"]).toBe("invalidInput");
  });
  test("an appointment notice takes no list, however it is spelled", () => {
    const base = {
      name: "Aviso",
      channel: "whatsapp" as const,
      kind: "appointment" as const,
      trigger: { event: "before_visit" as const, hours: 24 },
      content: {
        en: empty,
        es: empty,
        whatsapp: {
          templateId: "6f1c2a3e-1111-4222-8333-444455556666",
          params: [],
        },
      },
    };
    expect(validateCampaign({ ...base, audience }).ok).toBe(true);
    const out = validateCampaign({ ...base, audience: list });
    expect(out.ok).toBe(false);
    if (!out.ok)
      expect(out.errors["audience.manualIds"]).toBe("manualNotAllowed");
    expect(
      validateCampaign({ ...base, audience: { ...audience, manualOnly: true } })
        .ok,
    ).toBe(false);
  });
});
