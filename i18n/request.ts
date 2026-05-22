import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

const namespaces = [
  "common",
  "nav",
  "header",
  "footer",
  "home",
  "wellness",
  "medicine",
  "community",
  "booking",
  "blog",
  "auth",
  "contact",
  "about",
  "memberships",
  "serviceFaqs",
] as const;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const modules = await Promise.all(
    namespaces.map((ns) => import(`../messages/${locale}/${ns}.json`)),
  );

  const messages = Object.fromEntries(
    namespaces.map((ns, i) => [ns, modules[i].default]),
  );

  return { locale, messages };
});
