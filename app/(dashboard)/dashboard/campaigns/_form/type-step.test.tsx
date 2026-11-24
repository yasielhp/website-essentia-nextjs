import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import es from "../../../../../messages/es/dashboard.json";
import en from "../../../../../messages/en/dashboard.json";
import { formStateForStart, type FormState } from "./form-state";

process.env.NEXT_PUBLIC_INSFORGE_URL ??= "http://localhost:0";
process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY ??= "test";
const { TypeStep } = await import("./type-step");

const render = (state: FormState, locale: "es" | "en" = "es") =>
  renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      timeZone="Atlantic/Canary"
      messages={{ dashboard: locale === "es" ? es : en }}
    >
      <TypeStep state={state} dispatch={() => {}} onDone={() => {}} />
    </NextIntlClientProvider>,
  );

const email = formStateForStart({ channel: "email", kind: "standard" });
const whatsapp = formStateForStart({ channel: "whatsapp", kind: "standard" });

describe("the campaign type is a select, not a grid of cards", () => {
  test("one combobox named for the field; no card pressed, no grid", () => {
    const html = render(email);
    expect(html.match(/role="combobox"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Tipo de campaña"');
    expect(html).not.toContain("aria-pressed");
    expect(html).not.toContain("grid-cols");
  });

  test("the trigger shows the chosen kind's picture, name and description", () => {
    const html = render(email);
    expect(html).toContain("<svg");
    expect(html).toContain("Estándar");
    expect(html).toContain(es.campaigns.type.standardDesc);
  });

  test("on WhatsApp the description is the WhatsApp one, and in English too", () => {
    expect(render(whatsapp)).toContain(es.campaigns.type.standardDescWhatsApp);
    expect(render(whatsapp, "en")).toContain(
      en.campaigns.type.standardDescWhatsApp,
    );
    expect(render(email, "en")).toContain("Standard");
  });

  test("the list is not in the page until it is opened", () => {
    expect(render(email)).not.toContain('role="listbox"');
  });

  test("the channel switch and the note about who each channel writes to are still there", () => {
    const html = render(email);
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain(es.campaigns.type.consentNoteEmail);
    expect(render(whatsapp)).toContain(es.campaigns.type.consentNoteWhatsApp);
  });

  test("the select does not choose with the arrows: choosing advances the form", () => {
    const source = readFileSync(join(import.meta.dir, "type-step.tsx"), "utf8");
    expect(source).toContain("commitOnArrows={false}");
  });
});

describe("a saved campaign", () => {
  const saved = (kind: "standard" | "appointment") =>
    ({
      ...formStateForStart({ channel: "whatsapp", kind }),
      id: "c-1",
      savedKind: kind,
    }) as FormState;

  test("says it cannot change into an appointment notice, or out of one", () => {
    expect(render(saved("standard"))).toContain(es.campaigns.type.kindLocked);
    expect(render(saved("appointment"))).toContain(
      es.campaigns.type.kindLocked,
    );
  });

  test("a new campaign does not say it", () => {
    expect(render(whatsapp)).not.toContain(es.campaigns.type.kindLocked);
  });
});
