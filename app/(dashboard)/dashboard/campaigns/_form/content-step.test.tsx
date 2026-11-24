import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import es from "../../../../../messages/es/dashboard.json";
import en from "../../../../../messages/en/dashboard.json";
import { formReducer, initialFormState, type FormState } from "./form-state";

process.env.NEXT_PUBLIC_INSFORGE_URL ??= "http://localhost:0";
process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY ??= "test";
const { ContentStep } = await import("./content-step");

const render = (state: FormState, locale: "es" | "en" = "es") =>
  renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      timeZone="Atlantic/Canary"
      messages={{ dashboard: locale === "es" ? es : en }}
    >
      <ContentStep state={state} dispatch={() => {}} onDone={() => {}} />
    </NextIntlClientProvider>,
  );

const written = (hello: string) => ({
  subject: hello,
  preheader: "",
  title: `${hello}, título`,
  doc: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: hello }] }],
  },
});
const base: FormState = { ...initialFormState, name: "Reapertura" };
const withBoth = formReducer(base, {
  type: "SET_CONTENT_BOTH",
  content: { es: written("Hola"), en: written("Hello") },
});
const onEnglish = formReducer(withBoth, { type: "SET_LOCALE", locale: "en" });
const spanishOnly = formReducer(withBoth, {
  type: "SET_AUDIENCE",
  patch: { language: "es" },
});
const source = readFileSync(join(import.meta.dir, "content-step.tsx"), "utf8");

describe("«Qué dice» for an audience of both languages", () => {
  test("a switch Español | Inglés sits over the subject, Spanish on screen", () => {
    const html = render(withBoth);
    expect(html).toContain('role="radiogroup"');
    expect(html).toMatch(
      /id="campaign-content-language-es"[^>]*aria-checked="true"/,
    );
    expect(html).toMatch(
      /id="campaign-content-language-en"[^>]*aria-checked="false"/,
    );
    expect(html.indexOf('role="radiogroup"')).toBeLessThan(
      html.indexOf('id="campaign-es-subject"'),
    );
  });

  test("the fields are the ones of the language on screen, all of them", () => {
    const spanish = render(withBoth);
    for (const field of ["subject", "preheader", "title"]) {
      expect(spanish).toContain(`id="campaign-es-${field}"`);
      expect(spanish).not.toContain(`id="campaign-en-${field}"`);
    }
    expect(spanish).toContain('value="Hola"');
    expect(spanish).not.toContain('value="Hello"');

    const english = render(onEnglish);
    for (const field of ["subject", "preheader", "title"]) {
      expect(english).toContain(`id="campaign-en-${field}"`);
    }
    expect(english).toContain('value="Hello"');
    expect(english).toContain('value="Hello, título"');
    expect(english).not.toContain('value="Hola"');
  });

  test("there is no select to choose ONE language for everybody any more", () => {
    const html = render(withBoth);
    expect(html).not.toContain("campaign-send-locale");
    expect(html).not.toContain("Idioma del email");
    expect(source).not.toContain("sendLocale");
    expect(source).not.toContain("emailLanguage");
  });

  test("it says each contact gets the version of her language", () => {
    expect(render(withBoth)).toContain(es.campaigns.content.languageHint);
    expect(render(withBoth, "en")).toContain(en.campaigns.content.languageHint);
  });

  test("a version with something missing is marked on its tab and named", () => {
    const onlySpanish = formReducer(base, {
      type: "SET_CONTENT_BOTH",
      content: { es: written("Hola"), en: base.content.en },
    });
    const html = render(onlySpanish);
    expect(html).toContain('data-incomplete="en"');
    expect(html).not.toContain('data-incomplete="es"');
    expect(html).toContain("Falta completar: Inglés");
  });

  test("with both written there is no mark and no warning", () => {
    const html = render(withBoth);
    expect(html).not.toContain("data-incomplete");
    expect(html).not.toContain("Falta completar");
  });

  test("an A/B test asks for its two subjects in the language on screen", () => {
    const split = { ...onEnglish, kind: "split" as const };
    const html = render(split);
    expect(html).toContain('id="campaign-en-subject"');
    expect(html).toContain('id="campaign-en-subjectB"');
    // Neither language has its second subject yet: both tabs say so.
    expect(html).toContain('data-incomplete="es"');
    expect(html).toContain('data-incomplete="en"');
  });

  test("an error is shown on the field of the language it belongs to, and nowhere else", () => {
    const errored: FormState = {
      ...withBoth,
      fieldErrors: { "content.en.subject": "subjectRequired" },
    };
    expect(render(errored)).not.toContain(es.validation.subjectRequired);
    expect(render({ ...errored, activeLocale: "en" })).toContain(
      es.validation.subjectRequired,
    );
  });
});

describe("«Qué dice» for an audience that fixes a language", () => {
  test("has no switch: one version, and the line that says which", () => {
    const html = render(spanishOnly);
    expect(html).not.toContain('role="radiogroup"');
    expect(html).toContain("Se envía en Español, el idioma del segmento.");
    expect(html).toContain('id="campaign-es-subject"');
  });

  test("an English audience is written in English", () => {
    const english = formReducer(withBoth, {
      type: "SET_AUDIENCE",
      patch: { language: "en" },
    });
    const html = render(english);
    expect(html).not.toContain('role="radiogroup"');
    expect(html).toContain('id="campaign-en-subject"');
    expect(html).toContain('value="Hello"');
  });
});

describe("changing the language does not lose what was being typed", () => {
  // The flush itself (to its own language, before the switch, and before the
  // confirm judges the form) is `createDocFlusher`, run for real in
  // editor-flush.test.ts and form-actions.test.ts.
  test("the editor is a new one for each language, opened on that language's document", () => {
    // Static markup has no editor (it loads in the browser), so this one
    // stays a reading of the source: the key is what replaces the editor.
    expect(source).toContain("key={locale}");
  });
});
