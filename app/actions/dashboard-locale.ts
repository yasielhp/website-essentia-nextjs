"use server";

import { cookies } from "next/headers";
import { hasLocale } from "next-intl";
import { routing } from "../../i18n/routing";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "@/constants/i18n";

/**
 * Persist the dashboard's language choice.
 *
 * Next registers every export of a `"use server"` module as a server action,
 * so this file deliberately exports nothing but the action itself — no types,
 * no constants.
 */
export async function setDashboardLocale(locale: string) {
  if (!hasLocale(routing.locales, locale)) return;

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
  });
}
