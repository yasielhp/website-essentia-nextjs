import { describe, expect, test } from "bun:test";
import type { CampaignRow } from "@/types/campaign";
import { EMPTY_AUDIENCE } from "@/types/campaign";
import {
  AVAILABLE_KINDS,
  contentOf,
  formReducer,
  initialFormState,
  nextStep,
  reachIn,
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
  test("choosing only the send language keeps the count and moves everybody to it", () => {
    const before: FormState = {
      ...initialFormState,
      reach: { count: 7, en: 0, es: 7 },
    };
    const after = formReducer(before, {
      type: "SET_AUDIENCE",
      patch: { sendLocale: "en" },
    });
    expect(after.audience.sendLocale).toBe("en");
    // One language, one version: everybody who is reached gets this one.
    expect(after.reach).toEqual({ count: 7, en: 7, es: 0 });
  });
  test("an empty patch changes nothing, the breakdown included", () => {
    const before: FormState = {
      ...initialFormState,
      reach: { count: 7, en: 0, es: 7 },
    };
    const after = formReducer(before, { type: "SET_AUDIENCE", patch: {} });
    expect(after.reach).toEqual({ count: 7, en: 0, es: 7 });
  });
  test("no count yet stays no count", () => {
    const after = formReducer(initialFormState, {
      type: "SET_AUDIENCE",
      patch: { sendLocale: "en" },
    });
    expect(after.reach).toBeNull();
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

describe("reachIn", () => {
  const reach = { count: 6, en: 0, es: 6 };
  test("a segment that fixes a language sends in it, whatever sendLocale says", () => {
    const audience = { ...EMPTY_AUDIENCE, language: "en" as const };
    expect(reachIn(reach, audience)).toEqual({ count: 6, en: 6, es: 0 });
  });
  test("with nothing chosen it is Spanish, the house default", () => {
    expect(reachIn(reach, { ...EMPTY_AUDIENCE })).toEqual({
      count: 6,
      en: 0,
      es: 6,
    });
  });
  test("a chosen send language wins when the segment spans both", () => {
    const audience = { ...EMPTY_AUDIENCE, sendLocale: "en" as const };
    expect(reachIn(reach, audience)).toEqual({ count: 6, en: 6, es: 0 });
  });
  test("no count is still no count", () => {
    expect(reachIn(null, EMPTY_AUDIENCE)).toBeNull();
  });
});

describe("the appointment notice kind", () => {
  const onWhatsApp: FormState = { ...initialFormState, channel: "whatsapp" };

  test("is a kind the form can build", () => {
    expect(AVAILABLE_KINDS).toContain("appointment");
  });

  test("choosing it starts from its own trigger", () => {
    const after = formReducer(onWhatsApp, {
      type: "SET_KIND",
      kind: "appointment",
    });
    expect(after.kind).toBe("appointment");
    expect(after.trigger).toEqual({ event: "before_visit", hours: 24 });
  });

  test("and from the simple audience: no segment, nobody by hand, no booking filters", () => {
    const messy: FormState = {
      ...onWhatsApp,
      segmentId: "seg",
      segmentName: "Antiguas",
      pickedContacts: [{ id: "c1", name: "Ana", email: "a@x.com" }],
      reach: { count: 9, en: 3, es: 6 },
      audience: {
        ...EMPTY_AUDIENCE,
        language: "es",
        newsletter: true,
        services: ["yoga"],
        lastBooking: { op: "gt", days: 30 },
        neverBooked: false,
        hasBooked: true,
        manualIds: ["c1"],
        sendLocale: "es",
      },
    };
    const after = formReducer(messy, { type: "SET_KIND", kind: "appointment" });
    expect(after.segmentId).toBeNull();
    expect(after.segmentName).toBeNull();
    expect(after.pickedContacts).toEqual([]);
    expect(after.reach).toBeNull();
    expect(after.audience).toEqual({
      ...EMPTY_AUDIENCE,
      language: "any",
      sendLocale: "es",
    });
  });

  test("is refused for an email", () => {
    const email: FormState = { ...initialFormState, channel: "email" };
    expect(formReducer(email, { type: "SET_KIND", kind: "appointment" })).toBe(
      email,
    );
  });

  test("switching the channel to email takes the form back to a kind an email can be", () => {
    const state = formReducer(onWhatsApp, {
      type: "SET_KIND",
      kind: "appointment",
    });
    const after = formReducer(state, { type: "SET_CHANNEL", channel: "email" });
    expect(after.kind).toBe("standard");
    expect(after.trigger).toEqual({});
  });

  test("a saved campaign cannot become one", () => {
    const saved = load(whatsappCampaign({ kind: "standard", trigger: {} }));
    expect(formReducer(saved, { type: "SET_KIND", kind: "appointment" })).toBe(
      saved,
    );
  });

  test("a saved one cannot stop being one, but stays one", () => {
    const saved = load(
      whatsappCampaign({
        kind: "appointment",
        trigger: { event: "after_visit", hours: 2 },
      }),
    );
    expect(saved.savedKind).toBe("appointment");
    expect(formReducer(saved, { type: "SET_KIND", kind: "standard" })).toBe(
      saved,
    );
    expect(
      formReducer(saved, { type: "SET_KIND", kind: "appointment" }).trigger,
    ).toEqual({
      event: "after_visit",
      hours: 2,
    });
  });

  test("a saved ordinary campaign still changes among the ordinary kinds", () => {
    const saved = load(whatsappCampaign({ kind: "standard", trigger: {} }));
    expect(
      formReducer(saved, { type: "SET_KIND", kind: "automated" }).kind,
    ).toBe("automated");
  });

  test("a new campaign remembers no saved kind", () => {
    expect(initialFormState.savedKind).toBeNull();
  });
});

describe("choosing a segment that is a hand-made list", () => {
  const ID = "6f1c2a3e-1111-4222-8333-444455556661";
  const list = {
    language: "any" as const,
    newsletter: null,
    services: [],
    lastBooking: null,
    neverBooked: false,
    hasBooked: false,
    manualIds: [ID],
    manualOnly: true as const,
  };
  const filter = {
    ...list,
    language: "es" as const,
    manualIds: undefined,
    manualOnly: undefined,
  };

  test("the campaign copies the people and that it is a list", () => {
    const after = formReducer(initialFormState, {
      type: "SET_SEGMENT",
      id: "seg",
      name: "Mis clientas",
      conditions: list,
    });
    expect(after.audience.manualIds).toEqual([ID]);
    expect(after.audience.manualOnly).toBe(true);
  });

  test("going back to a filter, or to everyone, is no longer a list and drops the people", () => {
    const chosen = formReducer(initialFormState, {
      type: "SET_SEGMENT",
      id: "seg",
      name: "Mis clientas",
      conditions: list,
    });
    const back = formReducer(chosen, {
      type: "SET_SEGMENT",
      id: null,
      name: null,
      conditions: filter,
    });
    expect(back.audience.manualOnly).toBeUndefined();
    expect(back.audience.language).toBe("es");
  });

  test("a filter leaves the campaign's own hand-picked contacts alone, as it did", () => {
    const withPicks = {
      ...initialFormState,
      audience: { ...initialFormState.audience, manualIds: ["x"] },
    };
    const after = formReducer(withPicks, {
      type: "SET_SEGMENT",
      id: "seg",
      name: "Filtro",
      conditions: filter,
    });
    expect(after.audience.manualIds).toEqual(["x"]);
    expect(after.audience.manualOnly).toBeUndefined();
  });
});
