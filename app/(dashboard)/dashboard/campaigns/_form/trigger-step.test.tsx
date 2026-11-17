import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import es from "../../../../../messages/es/dashboard.json";
import { formStateForStart, type FormState } from "./form-state";

// The step reads the session types with the browser client, which refuses to be
// built without its address; a render never calls it.
process.env.NEXT_PUBLIC_INSFORGE_URL ??= "http://localhost:0";
process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY ??= "test";
const { TriggerStep } = await import("./trigger-step");

const base = formStateForStart({ channel: "email", kind: "automated" });

function render(state: FormState) {
  return renderToStaticMarkup(
    <NextIntlClientProvider
      locale="es"
      timeZone="Atlantic/Canary"
      messages={{ dashboard: es }}
    >
      <TriggerStep state={state} dispatch={() => {}} onDone={() => {}} />
    </NextIntlClientProvider>,
  );
}

describe("the description of the segment-entry trigger", () => {
  test("for a filter, it says people are picked up as they come in", () => {
    const html = render({ ...base, trigger: { event: "segment_entry" } });
    expect(html).toContain(es.campaigns.trigger.eventDesc.segment_entry);
  });
  test("for a hand-made list, which does not grow, it says it is sent once to the people on it", () => {
    const html = render({
      ...base,
      trigger: { event: "segment_entry" },
      audience: { ...base.audience, manualIds: ["x"], manualOnly: true },
    });
    expect(html).toContain("Se envía una vez a las personas de la lista.");
    expect(html).not.toContain(es.campaigns.trigger.eventDesc.segment_entry);
  });
});
