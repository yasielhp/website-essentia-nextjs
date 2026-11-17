import { describe, expect, test } from "bun:test";
import type { CampaignRow } from "@/types/campaign";
import { EMPTY_AUDIENCE } from "@/types/campaign";
import {
  contentOf,
  formReducer,
  initialFormState,
  nextStep,
  type FormState,
} from "./form-state";

const whatsappCampaign = (overrides: Partial<CampaignRow> = {}): CampaignRow =>
  ({
    id: "c1",
    name: "Reapertura",
    status: "draft",
    channel: "whatsapp",
    kind: "automated",
    trigger: { event: "after_booking", days: 2 },
    audience: { ...EMPTY_AUDIENCE, sendLocale: "es" },
    content: {
      en: { subject: "", preheader: "", title: "", doc: null },
      es: { subject: "", preheader: "", title: "", doc: null },
      whatsapp: {
        templateId: "tpl-1",
        params: [{ kind: "field", field: "first_name" }],
      },
    },
    segment_id: null,
    ...overrides,
  }) as CampaignRow;

const load = (campaign: CampaignRow): FormState =>
  formReducer(initialFormState, {
    type: "LOAD",
    campaign,
    picked: [],
    segmentName: null,
  });

describe("SET_CHANNEL", () => {
  test("a new campaign starts as an email", () => {
    expect(initialFormState.channel).toBe("email");
  });
  test("switching rewinds to the kind step and forgets the count", () => {
    const before: FormState = {
      ...initialFormState,
      step: 5,
      reach: { count: 10, en: 4, es: 6 },
    };
    const after = formReducer(before, {
      type: "SET_CHANNEL",
      channel: "whatsapp",
    });
    expect(after.channel).toBe("whatsapp");
    expect(after.step).toBe(0);
    expect(after.reach).toBeNull();
  });
  test("choosing the channel it already has changes nothing", () => {
    const before: FormState = { ...initialFormState, step: 3 };
    expect(formReducer(before, { type: "SET_CHANNEL", channel: "email" })).toBe(
      before,
    );
  });
  test("a kind a template cannot be falls back to standard", () => {
    for (const kind of ["split", "rss"] as const) {
      const before: FormState = { ...initialFormState, kind, step: 2 };
      const after = formReducer(before, {
        type: "SET_CHANNEL",
        channel: "whatsapp",
      });
      expect(after.kind).toBe("standard");
      expect(after.trigger).toEqual({});
    }
  });
  test("a kind that works on both keeps its trigger", () => {
    const before: FormState = {
      ...initialFormState,
      kind: "automated",
      trigger: { event: "after_booking", days: 3 },
    };
    const after = formReducer(before, {
      type: "SET_CHANNEL",
      channel: "whatsapp",
    });
    expect(after.kind).toBe("automated");
    expect(after.trigger).toEqual({ event: "after_booking", days: 3 });
  });
  test("a saved campaign cannot change channel", () => {
    const saved = load(whatsappCampaign());
    expect(formReducer(saved, { type: "SET_CHANNEL", channel: "email" })).toBe(
      saved,
    );
  });
  test("a kind the channel cannot be is refused", () => {
    const state: FormState = { ...initialFormState, channel: "whatsapp" };
    expect(formReducer(state, { type: "SET_KIND", kind: "split" })).toBe(state);
    expect(formReducer(state, { type: "SET_KIND", kind: "rss" })).toBe(state);
    expect(
      formReducer(state, { type: "SET_KIND", kind: "automated" }).kind,
    ).toBe("automated");
  });
});

describe("SET_WHATSAPP", () => {
  test("stores the template and what fills it", () => {
    const params = [{ kind: "static" as const, value: "hola" }];
    const after = formReducer(initialFormState, {
      type: "SET_WHATSAPP",
      templateId: "tpl-9",
      params,
    });
    expect(after.content.whatsapp).toEqual({ templateId: "tpl-9", params });
  });
  test("clears the errors that were about the template", () => {
    const before: FormState = {
      ...initialFormState,
      fieldErrors: {
        "content.whatsapp.templateId": "templateUnavailable",
        "content.whatsapp.params.0": "paramTooLong",
        name: "nameTaken",
      },
    };
    const after = formReducer(before, {
      type: "SET_WHATSAPP",
      templateId: "tpl-9",
      params: [],
    });
    expect(after.fieldErrors).toEqual({ name: "nameTaken" });
  });
});

describe("LOAD", () => {
  test("reopening a WhatsApp draft brings its channel and template back", () => {
    const state = load(whatsappCampaign());
    expect(state.channel).toBe("whatsapp");
    expect(state.kind).toBe("automated");
    expect(state.trigger).toEqual({ event: "after_booking", days: 2 });
    expect(state.content.whatsapp).toEqual({
      templateId: "tpl-1",
      params: [{ kind: "field", field: "first_name" }],
    });
  });
  test("an older row with no channel is an email", () => {
    const row = whatsappCampaign();
    // Rows saved before the column existed never had it.
    (row as { channel?: string }).channel = undefined;
    delete (row.content as { whatsapp?: unknown }).whatsapp;
    const state = load(row);
    expect(state.channel).toBe("email");
    expect(state.content.whatsapp).toBeUndefined();
  });
});

describe("SET_AUDIENCE", () => {
  test("choosing only the send language does not lose the count", () => {
    const before: FormState = {
      ...initialFormState,
      reach: { count: 7, en: 3, es: 4 },
    };
    const after = formReducer(before, {
      type: "SET_AUDIENCE",
      patch: { sendLocale: "en" },
    });
    expect(after.audience.sendLocale).toBe("en");
    expect(after.reach).toEqual({ count: 7, en: 3, es: 4 });
  });
  test("any other change makes the count stale", () => {
    const before: FormState = {
      ...initialFormState,
      reach: { count: 7, en: 3, es: 4 },
    };
    const after = formReducer(before, {
      type: "SET_AUDIENCE",
      patch: { newsletter: true },
    });
    expect(after.reach).toBeNull();
  });
});

describe("contentOf", () => {
  const withBoth: FormState = formReducer(initialFormState, {
    type: "SET_WHATSAPP",
    templateId: "tpl-1",
    params: [],
  });
  test("an email does not carry a WhatsApp block left over from a switch", () => {
    expect(
      contentOf({ ...withBoth, channel: "email" }).whatsapp,
    ).toBeUndefined();
  });
  test("a WhatsApp campaign keeps it", () => {
    expect(
      contentOf({ ...withBoth, channel: "whatsapp" }).whatsapp?.templateId,
    ).toBe("tpl-1");
  });
});

describe("nextStep", () => {
  test("an email walks every step its kind has", () => {
    expect(nextStep(0, "email", false)).toBe(1);
    expect(nextStep(2, "email", true)).toBe(3);
    expect(nextStep(2, "email", false)).toBe(4);
    expect(nextStep(3, "email", true)).toBe(4);
    expect(nextStep(4, "email", false)).toBe(5);
    expect(nextStep(5, "email", false)).toBe(6);
  });
  test("a WhatsApp campaign has no starting-point step: the template step is its content", () => {
    expect(nextStep(2, "whatsapp", false)).toBe(5);
    expect(nextStep(3, "whatsapp", true)).toBe(5);
    expect(nextStep(5, "whatsapp", false)).toBe(6);
  });
});
