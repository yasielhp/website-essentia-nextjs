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
const { ReviewStep } = await import("./review-step");

const render = (state: FormState, locale: "es" | "en" = "es") =>
  renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      timeZone="Atlantic/Canary"
      messages={{ dashboard: locale === "es" ? es : en }}
    >
      <ReviewStep
        state={state}
        templates={{ status: "idle" }}
        onLocale={() => {}}
        onTest={async () => {}}
        onSchedule={async () => {}}
        onSendNow={async () => {}}
        onActivate={async () => {}}
      />
    </NextIntlClientProvider>,
  );

const written = (hello: string) => ({
  subject: `${hello}, asunto`,
  preheader: "",
  title: `${hello}, título`,
  doc: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: hello }] }],
  },
});
const both: FormState = {
  ...formReducer(
    { ...initialFormState, name: "Reapertura" },
    {
      type: "SET_CONTENT_BOTH",
      content: { es: written("Hola"), en: written("Hello") },
    },
  ),
  reach: { count: 174, en: 89, es: 85 },
};
const onEnglish = formReducer(both, { type: "SET_LOCALE", locale: "en" });

describe("the review of an email for both languages", () => {
  test("says how many recipients go in each language", () => {
    const html = render(both);
    expect(html).toContain("174");
    expect(html).toContain("89 en inglés · 85 en español");
  });

  test("has the language switch, and shows the version on screen", () => {
    const spanish = render(both);
    expect(spanish).toMatch(
      /id="campaign-review-language-es"[^>]*aria-checked="true"/,
    );
    expect(spanish).toContain("Hola, asunto");
    expect(spanish).toContain("Hola, título");
    expect(spanish).not.toContain("Hello, asunto");

    const english = render(onEnglish);
    expect(english).toContain("Hello, asunto");
    expect(english).not.toContain("Hola, asunto");
  });

  test("the test is of the version on screen, and says which", () => {
    expect(render(both)).toContain("Versión de la prueba: Español");
    expect(render(onEnglish)).toContain("Versión de la prueba: Inglés");
    expect(render(onEnglish, "en")).toContain("Version of the test: English");
  });

  test("an A/B test shows its two subjects in the language on screen", () => {
    const split: FormState = {
      ...onEnglish,
      kind: "split",
      content: {
        ...onEnglish.content,
        en: { ...onEnglish.content.en, subjectB: "Hello again" },
      },
    };
    const html = render(split);
    expect(html).toContain("A · Hello, asunto");
    expect(html).toContain("B · Hello again");
  });
});

describe("the review of an email for one language", () => {
  const spanish = formReducer(both, {
    type: "SET_AUDIENCE",
    patch: { language: "es" },
  });

  test("has no switch and no line about which version the test is", () => {
    const html = render({ ...spanish, reach: { count: 85, en: 0, es: 85 } });
    expect(html).not.toContain('role="radiogroup"');
    expect(html).not.toContain("Versión de la prueba");
    expect(html).toContain("Hola, asunto");
    expect(html).toContain("0 en inglés · 85 en español");
  });
});

describe("the form sends the test of the version on screen", () => {
  const form = readFileSync(join(import.meta.dir, "campaign-form.tsx"), "utf8");

  test("the language on screen is what the action is given", () => {
    expect(form).toMatch(
      /sendTestCampaign\(\s*getAccessToken\(\),\s*state\.content,\s*state\.activeLocale,\s*\)/,
    );
  });

  test("the review's switch moves the same language the content step shows", () => {
    expect(form).toContain(
      'onLocale={(locale) => dispatch({ type: "SET_LOCALE", locale })}',
    );
  });

  test("a refused validation names the version that is missing", () => {
    expect(form).toContain("errorText(incompleteError(check.errors))");
  });
});
