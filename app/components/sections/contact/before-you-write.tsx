import { getTranslations } from "next-intl/server";
import { contact, OPENING_HOURS } from "@/constants/contact";
import { Link } from "../../../../i18n/navigation";

/**
 * What someone needs to know before filling in the contact form.
 *
 * The page was a heading and a form, which an audit read as thin — and which
 * left the two commonest reasons for writing, booking a session and asking what
 * membership costs, with no answer other than waiting for a reply.
 *
 * Every fact here is one the site already commits to: the reply time is the
 * same promise the form's own success message makes, the phone number and hours
 * come from `contact`, and the two routes out link to pages that answer those
 * questions in full. Server-rendered, so it is in the HTML for crawlers.
 */
export async function BeforeYouWrite() {
  const t = await getTranslations("contact.beforeYouWrite");

  const facts = [
    {
      label: t("hours.label"),
      value: t("hours.value", {
        opens: OPENING_HOURS.opens,
        closes: OPENING_HOURS.closes,
      }),
    },
    { label: t("reply.label"), value: t("reply.value") },
    {
      label: t("phone.label"),
      value: t("phone.value", { phone: contact.phone }),
    },
  ];

  const routes = [
    {
      text: t("routes.booking"),
      linkText: t("routes.bookingLink"),
      href: "/booking" as const,
    },
    {
      text: t("routes.memberships"),
      linkText: t("routes.membershipsLink"),
      href: "/experiences/memberships" as const,
    },
  ];

  return (
    <section className="bg-sand-50 px-5 pb-20 md:pb-28">
      <div className="mx-auto max-w-4xl">
        <h2 className="font-display text-petroleum-700 text-3xl md:text-4xl">
          {t("heading")}
        </h2>

        <dl className="divide-sand-200 mt-8 divide-y">
          {facts.map((fact) => (
            <div
              key={fact.label}
              className="gap-2 py-4 sm:flex sm:items-baseline sm:gap-8"
            >
              <dt className="text-petroleum-400 text-sm sm:w-56 sm:shrink-0">
                {fact.label}
              </dt>
              <dd className="text-petroleum-700 leading-relaxed">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>

        <h3 className="text-petroleum-700 mt-12 text-lg font-medium">
          {t("routes.heading")}
        </h3>
        <ul className="mt-4 space-y-5">
          {routes.map((route) => (
            <li key={route.href}>
              <p className="text-petroleum-500 leading-relaxed">{route.text}</p>
              <Link
                href={route.href}
                className="text-petroleum-500 hover:text-petroleum-700 mt-2 inline-block text-sm underline underline-offset-4 transition-colors"
              >
                {route.linkText}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
