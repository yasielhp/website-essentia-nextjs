import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import es from "../../../../../messages/es/dashboard.json";
import en from "../../../../../messages/en/dashboard.json";
import { template } from "@/lib/campaigns/whatsapp-fixtures";
import { formReducer, formStateForStart, type FormState } from "./form-state";
import { WhatsAppStep } from "./whatsapp-step";
import type { TemplatesState } from "./use-whatsapp-templates";

const state = formStateForStart({ channel: "whatsapp", kind: "standard" });

function render(
  templates: TemplatesState,
  locale: "es" | "en" = "es",
  form: FormState = state,
) {
  return renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      timeZone="Atlantic/Canary"
      messages={{ dashboard: locale === "es" ? es : en }}
    >
      <WhatsAppStep
        state={form}
        dispatch={() => {}}
        templates={templates}
        onRetryTemplates={() => {}}
        onDone={() => {}}
      />
    </NextIntlClientProvider>,
  );
}

describe("when the templates could not be loaded", () => {
  const html = render({ status: "error", error: "db" });
  test("says so and offers to try again, without a reload that would lose the campaign", () => {
    expect(html).toContain("No se pudieron cargar las plantillas.");
    expect(html).not.toContain("Recarga la página");
    expect(html).toContain("Reintentar");
    expect(render({ status: "error", error: "db" }, "en")).toContain(
      "The templates could not be loaded.",
    );
  });
});

describe("when there is no template to use", () => {
  const html = render({ status: "ready", templates: [], configured: true });
  test("the link to create one opens in another tab, safely, so the campaign is not lost", () => {
    const link =
      html.match(
        /<a [^>]*href="\/dashboard\/settings#settings-whatsapp-templates"[^>]*>/,
      )?.[0] ?? "";
    expect(link).toContain('target="_blank"');
    expect(link).toContain("noopener");
  });
});

describe("a template for each language of the audience", () => {
  const ES = template({
    id: "tpl-es",
    name: "reapertura",
    language: "es",
    body: "Hola {{1}}, volvemos",
    param_count: 1,
    example_params: ["Ana"],
  });
  const EN = template({
    id: "tpl-en",
    name: "reopening",
    language: "en",
    body: "Hello {{1}}, we are back",
    param_count: 1,
    example_params: ["Anna"],
  });
  const ready: TemplatesState = {
    status: "ready",
    templates: [ES, EN],
    configured: true,
  };
  const name = { kind: "field" as const, field: "first_name" as const };
  const pick = (form: FormState, locale: "es" | "en", templateId: string) =>
    formReducer(form, {
      type: "SET_WHATSAPP",
      locale,
      templateId,
      params: [name],
    });
  const onEnglish = (form: FormState) =>
    formReducer(form, { type: "SET_LOCALE", locale: "en" });

  test("an audience of both languages has the switch over the template, Spanish on screen", () => {
    const html = render(ready);
    expect(html).toContain('role="radiogroup"');
    expect(html).toMatch(
      /id="campaign-whatsapp-language-es"[^>]*aria-checked="true"/,
    );
    expect(html.indexOf('role="radiogroup"')).toBeLessThan(
      html.indexOf('id="campaign-whatsapp-template-es"'),
    );
    // No select to choose ONE language for everybody.
    expect(html).not.toContain("campaign-whatsapp-locale");
    expect(html).not.toContain("Idioma de envío");
  });

  test("it says each contact gets the template of her language", () => {
    expect(render(ready)).toContain(es.campaigns.form.whatsapp.languageHint);
    expect(render(ready, "en")).toContain(
      en.campaigns.form.whatsapp.languageHint,
    );
  });

  test("the select of a language is that language's own, with its template chosen", () => {
    const both = pick(pick(state, "es", "tpl-es"), "en", "tpl-en");
    const spanish = render(ready, "es", both);
    expect(spanish).toContain('id="campaign-whatsapp-template-es"');
    expect(spanish).not.toContain('id="campaign-whatsapp-template-en"');
    expect(spanish).toContain("Hola Ana, volvemos");
    expect(spanish).not.toContain("Hello Anna");

    const english = render(ready, "es", onEnglish(both));
    expect(english).toContain('id="campaign-whatsapp-template-en"');
    expect(english).toContain("Hello Anna, we are back");
    expect(english).not.toContain("Hola Ana, volvemos");
  });

  test("each language's values have their own inputs", () => {
    const both = pick(pick(state, "es", "tpl-es"), "en", "tpl-en");
    expect(render(ready, "es", both)).toContain("campaign-whatsapp-param-es");
    expect(render(ready, "es", onEnglish(both))).toContain(
      "campaign-whatsapp-param-en",
    );
  });

  test("the language with no template yet is marked and named; with both chosen there is no mark", () => {
    const onlySpanish = pick(state, "es", "tpl-es");
    const html = render(ready, "es", onlySpanish);
    expect(html).toContain('data-incomplete="en"');
    expect(html).not.toContain('data-incomplete="es"');
    expect(html).toContain("Falta completar: Inglés");

    const both = pick(onlySpanish, "en", "tpl-en");
    const done = render(ready, "es", both);
    expect(done).not.toContain("data-incomplete");
    expect(done).not.toContain("Falta completar");
  });

  test("nothing is called missing while the templates are still loading", () => {
    expect(render({ status: "loading" })).not.toContain("data-incomplete");
  });

  test("a template chosen for a language and since paused by Meta marks that language", () => {
    const both = pick(pick(state, "es", "tpl-es"), "en", "tpl-en");
    const paused: TemplatesState = {
      status: "ready",
      templates: [ES, { ...EN, status: "PAUSED" }],
      configured: true,
    };
    expect(render(paused, "es", both)).toContain('data-incomplete="en"');
    expect(render(paused, "es", onEnglish(both))).toContain(
      "La plantilla elegida ya no se puede usar",
    );
  });

  test("an error about a language's template is shown on that language and not on the other", () => {
    const both = pick(pick(state, "es", "tpl-es"), "en", "tpl-en");
    const errored: FormState = {
      ...both,
      fieldErrors: { "content.whatsapp.en.params": "paramCountMismatch" },
    };
    const message = es.validation.paramCountMismatch;
    expect(render(ready, "es", errored)).not.toContain(message);
    expect(render(ready, "es", onEnglish(errored))).toContain(message);
  });

  test("an audience that fixes a language has one version and no switch", () => {
    const spanish = formReducer(pick(state, "es", "tpl-es"), {
      type: "SET_AUDIENCE",
      patch: { language: "es" },
    });
    const html = render(ready, "es", spanish);
    expect(html).not.toContain('role="radiogroup"');
    expect(html).toContain("Se envía en Español, el idioma del segmento.");
    expect(html).toContain('id="campaign-whatsapp-template-es"');
  });

  test("an appointment notice says it of its clients, with no word about segments", () => {
    const notice = formStateForStart({
      channel: "whatsapp",
      kind: "appointment",
    });
    const html = render(ready, "es", notice);
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain(es.campaigns.form.whatsapp.languageHintAppointment);
    expect(es.campaigns.form.whatsapp.languageHintAppointment).not.toMatch(
      /segment/i,
    );
  });

  test("a campaign saved with one template and no language opens with it on its language's tab", () => {
    const loaded = formReducer(state, {
      type: "LOAD",
      picked: [],
      segmentName: null,
      campaign: {
        id: "c1",
        name: "Vieja",
        status: "draft",
        channel: "whatsapp",
        kind: "standard",
        trigger: {},
        audience: { ...state.audience, language: "any", sendLocale: "es" },
        content: {
          en: { subject: "", preheader: "", title: "", doc: null },
          es: { subject: "", preheader: "", title: "", doc: null },
          whatsapp: { templateId: "tpl-es", params: [name] },
        },
        segment_id: null,
      } as never,
    });
    const html = render(ready, "es", loaded);
    expect(html).toContain("Hola Ana, volvemos");
    // And the other language is what is left to do.
    expect(html).toContain('data-incomplete="en"');
    expect(html).not.toContain('data-incomplete="es"');
  });
});

describe("picking a template proposes the same one in the other language", () => {
  // Which writes a pick makes, and the proposal, are `pickTemplate`
  // (form-actions.test.ts). Here: the line that says it out loud.
  test("is said with the template's name and the language it was proposed for", () => {
    expect(es.campaigns.form.whatsapp.counterpart).toContain("{name}");
    expect(en.campaigns.form.whatsapp.counterpart).toContain("{language}");
  });
});
