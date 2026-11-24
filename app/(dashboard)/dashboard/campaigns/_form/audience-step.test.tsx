import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import es from "../../../../../messages/es/dashboard.json";
import en from "../../../../../messages/en/dashboard.json";
import { formStateForStart, type FormState } from "./form-state";

process.env.NEXT_PUBLIC_INSFORGE_URL ??= "http://localhost:0";
process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY ??= "test";
const { AudienceStep } = await import("./audience-step");
const { ReviewStep } = await import("./review-step");

const render = (node: React.ReactNode, locale: "es" | "en" = "es") =>
  renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      timeZone="Atlantic/Canary"
      messages={{ dashboard: locale === "es" ? es : en }}
    >
      {node}
    </NextIntlClientProvider>,
  );

const counted = (channel: "email" | "whatsapp"): FormState => ({
  ...formStateForStart({ channel, kind: "standard" }),
  name: "Reapertura",
  reach: { count: 10, en: 3, es: 7 },
});

const audience = (state: FormState, locale: "es" | "en" = "es") =>
  render(
    <AudienceStep state={state} dispatch={() => {}} onDone={() => {}} />,
    locale,
  );

describe("who an email campaign reaches, under the segment select", () => {
  test("the subscribers, counted, and the rule: a hand-picked contact does not get round it", () => {
    const html = audience(counted("email"));
    expect(html).toContain("10 suscritos a la newsletter");
    expect(html).toContain(es.campaigns.audience.reachEmailNote);
    expect(html).not.toContain(es.campaigns.audience.reachWhatsAppNote);
  });

  test("in English too", () => {
    expect(audience(counted("email"), "en")).toContain(
      "10 newsletter subscribers",
    );
  });

  test("'everyone' is everyone subscribed", () => {
    expect(audience(counted("email"))).toContain(
      es.campaigns.segment.everyoneEmail,
    );
  });

  test("WhatsApp keeps its own consent and its own words", () => {
    const html = audience(counted("whatsapp"));
    expect(html).toContain("10 con WhatsApp autorizado");
    expect(html).toContain(es.campaigns.audience.reachWhatsAppNote);
    expect(html).not.toContain(es.campaigns.audience.reachEmailNote);
  });
});

describe("the review of an email campaign", () => {
  const review = (state: FormState) =>
    render(
      <ReviewStep
        state={{ ...state, step: 6 }}
        templates={{ status: "idle" }}
        onLocale={() => {}}
        onTest={async () => {}}
        onSchedule={async () => {}}
        onSendNow={async () => {}}
        onActivate={async () => {}}
      />,
    );

  test("says subscribers only even with no condition set", () => {
    expect(review(counted("email"))).toContain(
      `<li>${es.campaigns.review.condNewsletter}</li>`,
    );
  });

  test("and once, when the segment also filters on it", () => {
    const state = counted("email");
    const html = review({
      ...state,
      audience: { ...state.audience, newsletter: true },
    });
    expect(
      html.split(`<li>${es.campaigns.review.condNewsletter}</li>`).length - 1,
    ).toBe(1);
  });

  test("a hand-made list says it too: being on it is not consent", () => {
    const state = counted("email");
    const html = review({
      ...state,
      audience: { ...state.audience, manualOnly: true, manualIds: ["a", "b"] },
    });
    expect(html).toContain("Lista manual de 2 personas");
    expect(html).toContain(`<li>${es.campaigns.review.condNewsletter}</li>`);
  });

  test("a WhatsApp campaign with no condition says its own consent instead", () => {
    const html = review(counted("whatsapp"));
    expect(html).toContain(es.campaigns.review.noConditionsWhatsApp);
    expect(html).not.toContain(es.campaigns.review.condNewsletter);
  });
});
