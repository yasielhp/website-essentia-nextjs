import { cookies } from "next/headers";
import { hasLocale } from "next-intl";
import { routing } from "../../i18n/routing";
import { LOCALE_COOKIE } from "@/constants/i18n";

export type DashboardLocale = (typeof routing.locales)[number];

/**
 * The dashboard renders outside the `[locale]` segment — `proxy.ts` keeps
 * next-intl's middleware off `/dashboard` entirely — so `requestLocale` is
 * always undefined there and `i18n/request.ts` cannot resolve it. Read the
 * shared locale cookie instead, the one the signed-in profile seeds.
 */
export async function getDashboardLocale(): Promise<DashboardLocale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return hasLocale(routing.locales, value) ? value : routing.defaultLocale;
}

/**
 * The `dashboard` namespace, plus `consent`: the contact file embeds the same
 * informed-consent form the public page uses, and that form reads its own
 * namespace. The rest of the public site's namespaces are irrelevant here and
 * would be serialised into every dashboard page for nothing.
 */
export async function getDashboardMessages(locale: DashboardLocale) {
  const [dashboard, consent] = await Promise.all([
    import(`../../messages/${locale}/dashboard.json`),
    import(`../../messages/${locale}/consent.json`),
  ]);
  return { dashboard: dashboard.default, consent: consent.default };
}
