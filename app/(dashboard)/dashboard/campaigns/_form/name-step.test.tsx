import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import es from "../../../../../messages/es/dashboard.json";
import { formStateForStart, type FormState } from "./form-state";
import { NameStep } from "./name-step";

function render(state: FormState) {
  return renderToStaticMarkup(
    <NextIntlClientProvider
      locale="es"
      timeZone="Atlantic/Canary"
      messages={{ dashboard: es }}
    >
      <NameStep state={state} dispatch={() => {}} onDone={() => {}} />
    </NextIntlClientProvider>,
  );
}

describe("the example in the name of a campaign", () => {
  test("an appointment notice suggests a name that tells when it goes out", () => {
    const html = render(
      formStateForStart({ channel: "whatsapp", kind: "appointment" }),
    );
    expect(html).toContain('placeholder="Recordatorio 48 h antes"');
  });
  test("any other kind keeps the usual one", () => {
    const html = render(
      formStateForStart({ channel: "email", kind: "standard" }),
    );
    expect(html).toContain('placeholder="Promoción de otoño"');
  });
});
