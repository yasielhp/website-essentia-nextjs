import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";
import { LOCALE_COOKIE } from "../app/constants/i18n";

const namespaces = [
  "common",
  "nav",
  "header",
  "footer",
  "home",
  "wellness",
  "medicine",
  "experiences",
  "booking",
  "blog",
  "auth",
  "contact",
  "about",
  "memberships",
  "serviceFaqs",
  "reviews",
  "account",
] as const;

/**
 * The account area sits outside `[locale]`, so `requestLocale` is undefined
 * there and every page fell back to English however the person had set their
 * language. The locale cookie — seeded from `profiles.preferred_language` on
 * sign-in — is the answer for those routes.
 *
 * Inside `[locale]` the segment still wins, which is what lets anyone read the
 * English pages by their URL whatever their preference says.
 *
 * On `setRequestLocale`, which next-intl deprecates in favour of Next 16's
 * `next/root-params`: that API only exposes dynamic segments of *the* root
 * layout, and this app has three — `(site)/[locale]`, `(dashboard)` and
 * `(account)` — of which only one carries the segment. A build confirms it:
 * `.next/types/root-params.d.ts` reads "No root params detected", so
 * `rootParams.locale()` would always be undefined. Migrating would mean moving
 * the dashboard and the account area inside `[locale]`, which is the opposite
 * of what `proxy.ts` deliberately does. The deprecation warning stays.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : hasLocale(routing.locales, fromCookie)
      ? fromCookie
      : routing.defaultLocale;

  const modules = await Promise.all(
    namespaces.map((ns) => import(`../messages/${locale}/${ns}.json`)),
  );

  const messages = Object.fromEntries(
    namespaces.map((ns, i) => [ns, modules[i].default]),
  );

  return { locale, messages };
});
