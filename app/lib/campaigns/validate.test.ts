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
      data: campaign,
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
