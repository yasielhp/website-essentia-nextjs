import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import es from "../../../../../messages/es/dashboard.json";
import en from "../../../../../messages/en/dashboard.json";
import { ReachFailed } from "./reach-failed";

function render(locale: "es" | "en", notReady: boolean) {
  return renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      timeZone="Atlantic/Canary"
      messages={{ dashboard: locale === "es" ? es : en }}
    >
      <ReachFailed onRetry={() => {}} notReady={notReady} />
    </NextIntlClientProvider>,
  );
}

describe("the audience that could not be counted", () => {
  test("a failure that may pass offers to try again", () => {
    const html = render("es", false);
    expect(html).toContain("<button");
  });
  test("a server not set up for WhatsApp says so and offers no retry, which would change nothing", () => {
    const html = render("es", true);
    expect(html).toContain(
      "WhatsApp aún no está listo en el servidor; avisa a quien administra la web.",
    );
    expect(html).not.toContain("<button");
    expect(render("en", true)).toContain(
      "WhatsApp is not ready on the server yet; tell whoever manages the website.",
    );
  });
});
