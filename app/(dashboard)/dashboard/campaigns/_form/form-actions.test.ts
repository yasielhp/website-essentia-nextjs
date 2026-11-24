import { describe, expect, test } from "bun:test";
import { createTranslator } from "next-intl";
import es from "../../../../../messages/es/dashboard.json";
import en from "../../../../../messages/en/dashboard.json";
import { template } from "@/lib/campaigns/whatsapp-fixtures";
import type { EmailDoc } from "@/types/campaign";
import { createDocFlusher } from "./editor-flush";
import {
  contentVerdict,
  pickTemplate,
  refusalText,
  serverErrorFocus,
  testRequest,
  type CampaignsTranslator,
} from "./form-actions";
import {
  formReducer,
  formStateForStart,
  initialFormState,
  type FormAction,
  type FormState,
} from "./form-state";

const doc = (text: string): EmailDoc => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});
const written = (hello: string) => ({
  subject: `${hello}, asunto`,
  preheader: "",
  title: `${hello}, título`,
  doc: doc(hello),
});
/** For everybody: both versions written. */
const both: FormState = formReducer(
  {
    ...initialFormState,
    name: "Reapertura",
    audience: { ...initialFormState.audience, language: "any" },
  },
  {
    type: "SET_CONTENT_BOTH",
    content: { es: written("Hola"), en: written("Hello") },
  },
);
const onEnglish = formReducer(both, { type: "SET_LOCALE", locale: "en" });

describe("testRequest: the test is of the version on screen", () => {
  test("an email: the content and the language on screen", () => {
    expect(testRequest(onEnglish)).toEqual({
      channel: "email",
      content: onEnglish.content,
      locale: "en",
    });
    expect(testRequest(both)).toMatchObject({ locale: "es" });
  });

  test("a WhatsApp campaign: its templates, the audience they are for and the language on screen", () => {
    const whatsapp = formReducer(
      formReducer(
        formStateForStart({ channel: "whatsapp", kind: "standard" }),
        {
          type: "SET_WHATSAPP",
          locale: "en",
          templateId: "tpl-en",
          params: [],
        },
      ),
      { type: "SET_LOCALE", locale: "en" },
    );
    const request = testRequest(whatsapp);
    expect(request).toMatchObject({
      channel: "whatsapp",
      audience: whatsapp.audience,
      locale: whatsapp.activeLocale,
    });
    expect(request.content.whatsapp?.en?.templateId).toBe("tpl-en");
  });
});

describe("contentVerdict: what the confirm of the content step leads to", () => {
  const noEnglishBody = formReducer(onEnglish, {
    type: "SET_DOC",
    locale: "en",
    doc: { type: "doc", content: [] },
  });

  test("both versions written: the step is done", () => {
    expect(contentVerdict(both)).toEqual({ kind: "done", errors: null });
  });

  test("a version with something missing comes on screen, and the toast names it", () => {
    expect(
      contentVerdict(
        formReducer(noEnglishBody, {
          type: "SET_LOCALE",
          locale: "es",
        }),
      ),
    ).toMatchObject({ kind: "show", locale: "en", toast: "missing_en" });
  });

  test("the words still in the editor count: flushed first, the step is done instead of switching language", () => {
    // The admin wrote the English body and pressed "confirm" within the beat:
    // the form does not have it yet.
    const actions: FormAction[] = [];
    const flusher = createDocFlusher((action) => actions.push(action));
    flusher.typed("en", () => doc("Hello again"));

    // Judged on the form of a beat ago, English would be "missing" and the
    // screen would switch to it.
    expect(contentVerdict(noEnglishBody)).toMatchObject({
      kind: "show",
      locale: "en",
    });
    // What the step now does: flush, and judge with what it wrote.
    const writtenNow = flusher.flush();
    expect(writtenNow).not.toBeNull();
    const judged = formReducer(noEnglishBody, writtenNow as FormAction);
    expect(contentVerdict(judged)).toEqual({ kind: "done", errors: null });
    expect(judged.content.en.doc).toEqual(doc("Hello again"));
  });

  test("words typed in Spanish land in Spanish even when the confirm then shows English", () => {
    const noEnglish = formReducer(both, {
      type: "SET_DOC",
      locale: "en",
      doc: { type: "doc", content: [] },
    });
    const flusher = createDocFlusher(() => {});
    flusher.typed("es", () => doc("Hola, última versión"));
    const judged = formReducer(noEnglish, flusher.flush() as FormAction);
    expect(judged.content.es.doc).toEqual(doc("Hola, última versión"));
    expect(contentVerdict(judged)).toMatchObject({
      kind: "show",
      locale: "en",
      toast: "missing_en",
    });
  });

  test("an English subject too long says English has errors, not that it is missing", () => {
    const long = formReducer(both, {
      type: "SET_CONTENT",
      locale: "en",
      field: "subject",
      value: "x".repeat(121),
    });
    expect(contentVerdict(long)).toMatchObject({
      kind: "show",
      locale: "en",
      toast: "errors_en",
    });
  });
});

describe("serverErrorFocus: after the server refused a save", () => {
  test("an error on the version not on screen brings it on screen", () => {
    expect(
      serverErrorFocus({ "content.en.subject": "subjectRequired" }, "es"),
    ).toEqual({ locale: "en", reopenContent: false });
  });

  test("the version on screen stays when it has an error of its own", () => {
    expect(
      serverErrorFocus(
        {
          "content.es.subject": "subjectRequired",
          "content.en.subject": "subjectRequired",
        },
        "en",
      ),
    ).toEqual({ locale: "en", reopenContent: false });
  });

  test("a WhatsApp template is fixed in the content step, which opens again", () => {
    expect(
      serverErrorFocus(
        { "content.whatsapp.en.templateId": "templateUnavailable" },
        "es",
      ),
    ).toEqual({ locale: "en", reopenContent: true });
  });

  test("an error of nobody's language moves nothing", () => {
    expect(serverErrorFocus({ name: "nameTaken" }, "en")).toEqual({
      locale: null,
      reopenContent: false,
    });
  });
});

describe("refusalText: a refusal in the admin's words", () => {
  const translator = (locale: "es" | "en") => {
    const t = createTranslator({
      locale,
      messages: { dashboard: locale === "es" ? es : en },
      namespace: "dashboard.campaigns",
    });
    const say = ((key: string, values?: Record<string, string>) =>
      t(key as never, values as never)) as CampaignsTranslator;
    say.has = (key: string) => t.has(key as never);
    return say;
  };

  test("a template that cannot go out names the language whose template it is", () => {
    expect(
      refusalText(translator("es"), {
        error: "template_unavailable",
        locale: "en",
      }),
    ).toBe(
      "La plantilla de la versión en Inglés no está aprobada o ya no se puede enviar.",
    );
    expect(
      refusalText(translator("en"), {
        error: "template_unavailable",
        locale: "es",
      }),
    ).toBe(
      "The template of the Spanish version is not approved or can no longer be sent.",
    );
  });

  test("without a language, the plain sentence of the code", () => {
    expect(
      refusalText(translator("es"), { error: "template_unavailable" }),
    ).toBe(es.campaigns.errors.template_unavailable);
    expect(refusalText(translator("en"), { error: "missing_en" })).toBe(
      en.campaigns.errors.missing_en,
    );
  });

  test("a code with no sentence is the generic one, never the code", () => {
    expect(refusalText(translator("es"), { error: "something_new" })).toBe(
      es.campaigns.errors.generic,
    );
    expect(refusalText(translator("en"), {})).toBe(en.campaigns.errors.generic);
  });
});

describe("pickTemplate: picking proposes the same template in the other language", () => {
  const ES = template({ id: "tpl-es", name: "reapertura", language: "es" });
  const EN = template({ id: "tpl-en", name: "reapertura", language: "en" });
  const OTHER = template({ id: "tpl-x", name: "otra", language: "en" });
  const all = [ES, EN, OTHER];
  const name = { kind: "field" as const, field: "first_name" as const };
  const pick = (blocks: Parameters<typeof pickTemplate>[0]["blocks"]) =>
    pickTemplate({
      all,
      picked: ES,
      locale: "es",
      locales: ["es", "en"],
      blocks,
      params: [name],
      kind: "standard",
    });

  test("for a language that has none yet, said out loud", () => {
    const { actions, proposed } = pick({ es: null, en: null });
    const blank = { kind: "static" as const, value: "" };
    expect(actions).toEqual([
      // The values already set are kept; the template's other `{{n}}` start
      // as a blank fixed text.
      {
        type: "SET_WHATSAPP",
        locale: "es",
        templateId: "tpl-es",
        params: [name, blank],
      },
      // The other language's are still to be set there.
      {
        type: "SET_WHATSAPP",
        locale: "en",
        templateId: "tpl-en",
        params: [blank, blank],
      },
    ]);
    expect(proposed).toEqual({ locale: "en", name: "reapertura" });
  });

  test("a language that already has its template keeps it, and nothing is proposed", () => {
    const { actions, proposed } = pick({
      es: null,
      en: { templateId: "tpl-x", params: [] },
    });
    expect(actions.map((a) => a.type === "SET_WHATSAPP" && a.locale)).toEqual([
      "es",
    ]);
    expect(proposed).toBeNull();
  });

  test("every write names the language it is for", () => {
    const { actions } = pick({ es: null, en: null });
    for (const action of actions) {
      expect(action.type).toBe("SET_WHATSAPP");
      expect(["es", "en"]).toContain(
        (action as Extract<FormAction, { type: "SET_WHATSAPP" }>).locale,
      );
    }
  });

  test("an audience of one language proposes nothing", () => {
    const { actions, proposed } = pickTemplate({
      all,
      picked: ES,
      locale: "es",
      locales: ["es"],
      blocks: { es: null, en: null },
      params: [],
      kind: "standard",
    });
    expect(actions).toHaveLength(1);
    expect(proposed).toBeNull();
  });
});
