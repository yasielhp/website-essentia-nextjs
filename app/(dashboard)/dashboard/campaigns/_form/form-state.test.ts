import { describe, expect, test } from "bun:test";
import type { CampaignRow, SegmentConditions } from "@/types/campaign";
import { EMPTY_AUDIENCE } from "@/types/campaign";
import {
  AVAILABLE_KINDS,
  formStateForStart,
  STEP_OF,
  contentOf,
  firstErroredLocale,
  formReducer,
  incompleteLocales,
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
  const params = [{ kind: "static" as const, value: "hola" }];

  test("stores the template of a language and what fills it, and leaves the other language alone", () => {
    const spanish = formReducer(initialFormState, {
      type: "SET_WHATSAPP",
      locale: "es",
      templateId: "tpl-es",
      params,
    });
    expect(spanish.content.whatsapp).toEqual({
      es: { templateId: "tpl-es", params },
    });
    const both = formReducer(spanish, {
      type: "SET_WHATSAPP",
      locale: "en",
      templateId: "tpl-en",
      params: [],
    });
    expect(both.content.whatsapp).toEqual({
      es: { templateId: "tpl-es", params },
      en: { templateId: "tpl-en", params: [] },
    });
  });

  test("clears the errors that were about that language's template, and no others", () => {
    const before: FormState = {
      ...initialFormState,
      fieldErrors: {
        "content.whatsapp.es.templateId": "templateUnavailable",
        "content.whatsapp.es.params.0": "paramTooLong",
        "content.whatsapp.en.templateId": "templateRequired",
        name: "nameTaken",
      },
    };
    const after = formReducer(before, {
      type: "SET_WHATSAPP",
      locale: "es",
      templateId: "tpl-9",
      params: [],
    });
    expect(after.fieldErrors).toEqual({
      "content.whatsapp.en.templateId": "templateRequired",
      name: "nameTaken",
    });
  });
});

describe("LOAD", () => {
  test("reopening a WhatsApp draft brings its channel and template back", () => {
    const state = load(whatsappCampaign());
    expect(state.channel).toBe("whatsapp");
    expect(state.kind).toBe("automated");
    expect(state.trigger).toEqual({ event: "after_booking", days: 2 });
    // Saved with one template and no language, for everybody with Spanish
    // as its send language: it comes back as the Spanish template.
    expect(state.content.whatsapp).toEqual({
      es: {
        templateId: "tpl-1",
        params: [{ kind: "field", field: "first_name" }],
      },
    });
  });
  test("a draft saved with a template per language comes back as it was", () => {
    const whatsapp = {
      es: { templateId: "tpl-es", params: [] },
      en: {
        templateId: "tpl-en",
        params: [{ kind: "field" as const, field: "first_name" as const }],
      },
    };
    const row = whatsappCampaign();
    row.content = { ...row.content, whatsapp };
    expect(load(row).content.whatsapp).toEqual(whatsapp);
  });
  test("an old one whose send language was English comes back as the English template", () => {
    const row = whatsappCampaign({
      audience: { ...EMPTY_AUDIENCE, sendLocale: "en" },
    });
    expect(Object.keys(load(row).content.whatsapp ?? {})).toEqual(["en"]);
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
  test("an empty patch changes nothing, the breakdown by language included", () => {
    const before: FormState = {
      ...initialFormState,
      reach: { count: 7, en: 3, es: 4 },
    };
    const after = formReducer(before, { type: "SET_AUDIENCE", patch: {} });
    expect(after.reach).toEqual({ count: 7, en: 3, es: 4 });
  });
  test("any change of who is in it makes the count stale", () => {
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
  test("the form no longer names one send language for everybody", () => {
    expect(initialFormState.audience.sendLocale).toBeUndefined();
    const after = formReducer(initialFormState, {
      type: "SET_AUDIENCE",
      patch: { language: "en" },
    });
    expect(after.audience.sendLocale).toBeUndefined();
    const segment = formReducer(initialFormState, {
      type: "SET_SEGMENT",
      id: "seg",
      name: "Todas",
      conditions: { ...EMPTY_AUDIENCE } as SegmentConditions,
    });
    expect(segment.audience.sendLocale).toBeUndefined();
  });
  test("a send language an old campaign carried is dropped the first time its audience is touched", () => {
    const old = load(
      whatsappCampaign({
        channel: "email",
        audience: { ...EMPTY_AUDIENCE, sendLocale: "en" },
      }),
    );
    const after = formReducer(old, {
      type: "SET_AUDIENCE",
      patch: { newsletter: true },
    });
    expect(after.audience.sendLocale).toBeUndefined();
  });
});

describe("contentOf", () => {
  const withBoth: FormState = formReducer(initialFormState, {
    type: "SET_WHATSAPP",
    locale: "es",
    templateId: "tpl-1",
    params: [],
  });
  test("an email does not carry a WhatsApp block left over from a switch", () => {
    expect(
      contentOf({ ...withBoth, channel: "email" }).whatsapp,
    ).toBeUndefined();
  });
  test("a WhatsApp campaign keeps it, a template per language", () => {
    expect(contentOf({ ...withBoth, channel: "whatsapp" }).whatsapp).toEqual({
      es: { templateId: "tpl-1", params: [] },
    });
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
      },
    };
    const after = formReducer(messy, { type: "SET_KIND", kind: "appointment" });
    expect(after.segmentId).toBeNull();
    expect(after.segmentName).toBeNull();
    expect(after.pickedContacts).toEqual([]);
    expect(after.reach).toBeNull();
    // Every client, in her own language: the notice starts for both.
    expect(after.audience).toEqual({ ...EMPTY_AUDIENCE, language: "any" });
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

describe("the form opened from a link that names the type", () => {
  test("an appointment notice starts on WhatsApp, as that kind, on the name step", () => {
    const state = formStateForStart({
      channel: "whatsapp",
      kind: "appointment",
    });
    expect(state.channel).toBe("whatsapp");
    expect(state.kind).toBe("appointment");
    expect(state.trigger).toEqual({ event: "before_visit", hours: 24 });
    expect(state.step).toBe(STEP_OF.name);
    expect(state.id).toBeNull();
  });
  test("an ordinary start is the form as a link with no type opens it, one step on", () => {
    const state = formStateForStart({ channel: "email", kind: "standard" });
    expect(state.channel).toBe("email");
    expect(state.kind).toBe("standard");
    expect(state.step).toBe(STEP_OF.name);
  });
});

describe("leaving a hand-made list for another segment", () => {
  const A = "6f1c2a3e-1111-4222-8333-444455556661";
  const B = "6f1c2a3e-1111-4222-8333-444455556662";
  const base = {
    language: "any" as const,
    newsletter: null,
    services: [],
    lastBooking: null,
    neverBooked: false,
    hasBooked: false,
  };
  const list = { ...base, manualIds: [A, B], manualOnly: true as const };
  const filter = { ...base, language: "es" as const };
  const choose = (
    state: FormState,
    conditions: SegmentConditions,
    id: string | null = "seg",
  ) =>
    formReducer(state, {
      type: "SET_SEGMENT",
      id,
      name: id ? "x" : null,
      conditions,
    });

  test("list to filter: the list's people are gone, and it is no longer a list", () => {
    const out = choose(choose(initialFormState, list), filter);
    expect(out.audience.manualIds).toEqual([]);
    expect(out.audience.manualOnly).toBeUndefined();
    expect(out.audience.language).toBe("es");
  });
  test("list to everyone: the same", () => {
    const out = choose(choose(initialFormState, list), { ...base }, null);
    expect(out.audience.manualIds).toEqual([]);
    expect(out.audience.manualOnly).toBeUndefined();
  });
  test("a contact picked by hand in the campaign survives the trip through a list", () => {
    const withExtra: FormState = {
      ...initialFormState,
      pickedContacts: [{ id: "x", name: "Ana", email: "a@b.c" }],
      audience: { ...initialFormState.audience, manualIds: ["x"] },
    };
    const onList = choose(withExtra, list);
    expect(onList.audience.manualIds).toEqual([A, B]);
    const back = choose(onList, filter);
    expect(back.audience.manualIds).toEqual(["x"]);
    expect(back.audience.manualOnly).toBeUndefined();
  });
  test("list to another list is that list's people", () => {
    const other = { ...list, manualIds: [B] };
    expect(
      choose(choose(initialFormState, list), other).audience.manualIds,
    ).toEqual([B]);
  });
});

describe("the language on screen is always one the campaign is written in", () => {
  const written = (hello: string) => ({
    subject: hello,
    preheader: "",
    title: hello,
    doc: {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: hello }] },
      ],
    },
  });
  const onEnglish = formReducer(initialFormState, {
    type: "SET_LOCALE",
    locale: "en",
  });

  test("a new campaign for everybody opens on Spanish and can be switched to English", () => {
    expect(initialFormState.activeLocale).toBe("es");
    expect(onEnglish.activeLocale).toBe("en");
  });

  test("narrowing the audience to Spanish brings the Spanish version on screen: the English one is gone", () => {
    const after = formReducer(onEnglish, {
      type: "SET_AUDIENCE",
      patch: { language: "es" },
    });
    expect(after.activeLocale).toBe("es");
  });

  test("an English audience is edited in English", () => {
    const after = formReducer(initialFormState, {
      type: "SET_AUDIENCE",
      patch: { language: "en" },
    });
    expect(after.activeLocale).toBe("en");
  });

  test("a segment that fixes a language does the same", () => {
    const after = formReducer(initialFormState, {
      type: "SET_SEGMENT",
      id: "seg-en",
      name: "English speakers",
      conditions: { ...EMPTY_AUDIENCE, language: "en" } as SegmentConditions,
    });
    expect(after.activeLocale).toBe("en");
  });

  test("a language the audience leaves out cannot be put on screen", () => {
    const spanish = formReducer(initialFormState, {
      type: "SET_AUDIENCE",
      patch: { language: "es" },
    });
    expect(
      formReducer(spanish, { type: "SET_LOCALE", locale: "en" }).activeLocale,
    ).toBe("es");
  });

  test("widening the audience back keeps the language that was on screen", () => {
    const english = formReducer(initialFormState, {
      type: "SET_AUDIENCE",
      patch: { language: "en" },
    });
    const everybody = formReducer(english, {
      type: "SET_AUDIENCE",
      patch: { language: "any" },
    });
    expect(everybody.activeLocale).toBe("en");
  });

  test("what was written in a language survives the audience leaving it and coming back", () => {
    const withEnglish = formReducer(initialFormState, {
      type: "SET_CONTENT",
      locale: "en",
      field: "subject",
      value: "Hello",
    });
    const there = formReducer(withEnglish, {
      type: "SET_AUDIENCE",
      patch: { language: "es" },
    });
    const back = formReducer(there, {
      type: "SET_AUDIENCE",
      patch: { language: "any" },
    });
    expect(back.content.en.subject).toBe("Hello");
  });

  test("a saved English campaign reopens on English, one for everybody on Spanish", () => {
    const row = whatsappCampaign({ channel: "email" });
    expect(
      load({ ...row, audience: { ...EMPTY_AUDIENCE, language: "en" } })
        .activeLocale,
    ).toBe("en");
    expect(load(row).activeLocale).toBe("es");
  });

  test("a starting point writes both languages at once", () => {
    const after = formReducer(
      {
        ...initialFormState,
        fieldErrors: {
          "content.es.subject": "subjectRequired",
          "content.en.doc": "bodyRequired",
          name: "nameRequired",
        },
      },
      {
        type: "SET_CONTENT_BOTH",
        content: { es: written("Hola"), en: written("Hello") },
      },
    );
    expect(after.content.es.subject).toBe("Hola");
    expect(after.content.en.subject).toBe("Hello");
    // The errors about the old words go with them; the others stay.
    expect(after.fieldErrors).toEqual({ name: "nameRequired" });
  });

  describe("which versions have something missing", () => {
    const named = { ...initialFormState, name: "Reapertura" };
    const fill = (state: FormState, locale: "es" | "en", hello: string) =>
      formReducer(state, {
        type: "SET_CONTENT_ALL",
        locale,
        content: written(hello),
      });

    test("a new campaign for everybody lacks both", () => {
      expect(incompleteLocales(named)).toEqual(["es", "en"]);
    });

    test("with the Spanish written, only the English", () => {
      expect(incompleteLocales(fill(named, "es", "Hola"))).toEqual(["en"]);
    });

    test("with both, none", () => {
      expect(
        incompleteLocales(fill(fill(named, "es", "Hola"), "en", "Hello")),
      ).toEqual([]);
    });

    test("a Spanish audience is never asked for the English", () => {
      const spanish = formReducer(named, {
        type: "SET_AUDIENCE",
        patch: { language: "es" },
      });
      expect(incompleteLocales(spanish)).toEqual(["es"]);
      expect(incompleteLocales(fill(spanish, "es", "Hola"))).toEqual([]);
    });

    test("an A/B test lacks a version until it has its second subject", () => {
      const split = {
        ...fill(fill(named, "es", "Hola"), "en", "Hello"),
        kind: "split" as const,
      };
      expect(incompleteLocales(split)).toEqual(["es", "en"]);
    });

    test("an error that is not about a language marks none", () => {
      // No name: the campaign is invalid, but both versions are whole.
      expect(
        incompleteLocales(
          fill(fill(initialFormState, "es", "Hola"), "en", "Hello"),
        ),
      ).toEqual([]);
    });
  });

  describe("where a refused validation takes the admin", () => {
    test("to the language on screen when it has an error of its own", () => {
      const errors = {
        "content.es.subject": "subjectRequired",
        "content.en.subject": "subjectRequired",
      };
      expect(firstErroredLocale(errors, "en")).toBe("en");
      expect(firstErroredLocale(errors, "es")).toBe("es");
    });

    test("to the other one when the one on screen is whole", () => {
      expect(
        firstErroredLocale({ "content.en.doc": "bodyRequired" }, "es"),
      ).toBe("en");
    });

    test("nowhere when no language has an error", () => {
      expect(firstErroredLocale({ name: "nameRequired" }, "es")).toBeNull();
    });
  });
});
