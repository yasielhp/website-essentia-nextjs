import { getTranslations } from "next-intl/server";
import { Link } from "../../../../i18n/navigation";

/**
 * What can actually be booked from this page, listed under the form.
 *
 * The booking page was almost entirely form — a heading, a subheading and a
 * widget — which a site audit flagged as thin, and which left the page with
 * nothing to rank on and no route onward for someone still deciding.
 *
 * Every line here is the description already written for that service's own
 * page, read from its own namespace: nothing is restated in a second place
 * that could drift, and nothing is invented. Rendered on the server, so it is
 * in the HTML for crawlers without shipping any JavaScript.
 */

/** The four services the booking flow offers, and where each one is described. */
const BOOKABLE = [
  {
    id: "manual-therapies",
    namespace: "wellness.protocols.items",
    href: "/wellness/manual-therapies",
  },
  {
    id: "facial-therapies",
    namespace: "wellness.protocols.items",
    href: "/wellness/facial-therapies",
  },
  {
    id: "red-light-therapy",
    namespace: "wellness.protocols.items",
    href: "/wellness/red-light-therapy",
  },
  {
    id: "intravenous-therapy",
    namespace: "medicine.treatments.items",
    href: "/medicine/intravenous-therapy",
  },
] as const;

export async function BookableServices() {
  const t = await getTranslations("booking.bookableServices");
  const tWellness = await getTranslations("wellness.protocols.items");
  const tMedicine = await getTranslations("medicine.treatments.items");

  const services = BOOKABLE.map(({ id, namespace, href }) => {
    const source = namespace.startsWith("wellness") ? tWellness : tMedicine;
    return {
      id,
      href,
      title: source(`${id}.title`),
      description: source(`${id}.description`),
    };
  });

  return (
    <section className="bg-sand-50 px-5 py-20 md:py-28">
      <div className="mx-auto max-w-4xl">
        <h2 className="font-display text-petroleum-700 text-3xl md:text-4xl">
          {t("heading")}
        </h2>
        <p className="text-petroleum-500 mt-4 max-w-2xl leading-relaxed">
          {t("lead")}
        </p>

        <ul className="divide-sand-200 mt-10 divide-y">
          {services.map((service) => (
            <li key={service.id} className="py-6">
              <h3 className="text-petroleum-700 text-lg font-medium">
                {service.title}
              </h3>
              <p className="text-petroleum-500 mt-2 leading-relaxed">
                {service.description}
              </p>
              <Link
                href={service.href}
                className="text-petroleum-500 hover:text-petroleum-700 mt-3 inline-block text-sm underline underline-offset-4 transition-colors"
              >
                {t("learnMore")}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
