import { getTranslations } from "next-intl/server";
import { BookingStepper } from "./booking-stepper";

/**
 * The heading is rendered on the server, the stepper is not.
 *
 * The whole page used to be a `dynamic(..., { ssr: false })` import, so the
 * initial HTML of the site's main conversion page carried no text at all — no
 * h1, nothing to read without running JavaScript. The interactive part still
 * loads in the browser; the part search engines and readers need does not
 * depend on it.
 */
export default async function BookingSection() {
  const t = await getTranslations("booking");

  return (
    <section className="bg-sand-50 md:min-h-dvh">
      <div className="mx-auto max-w-4xl px-5 pt-32 pb-24 md:pt-48">
        <div className="mb-8 flex flex-col gap-2">
          <h1 className="font-display text-petroleum-700 text-4xl md:text-5xl">
            {t("heading")}
          </h1>
          <p className="text-petroleum-400">{t("subheading")}</p>
        </div>
        <BookingStepper />
      </div>
    </section>
  );
}
