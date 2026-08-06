"use server";

import { cookies } from "next/headers";
import { hasLocale } from "next-intl";
import { routing } from "../../i18n/routing";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "@/constants/i18n";
import { createInsForgeServerClient } from "@/lib/insforge-server";

/**
 * One language per person, wherever they are.
 *
 * The dashboard used to keep its own cookie and the public site another, so a
 * staff member who set the panel to Spanish still met the site in English, and
 * neither choice survived a different browser. The language now lives on the
 * profile, and the cookie is only how a request finds out about it.
 *
 * Writing it in either place writes it in both: whichever selector the person
 * reaches for, the preference follows them.
 */

/** Writes the locale cookie. Safe to call with an unknown or missing value. */
export async function applyPreferredLanguage(language?: string | null) {
  if (!hasLocale(routing.locales, language)) return;

  const store = await cookies();
  store.set(LOCALE_COOKIE, language, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
  });
}

/**
 * Records the choice against the signed-in profile and in the cookie.
 *
 * A visitor with no session still gets the cookie — that is how the public
 * site remembers a language for someone who never signs in.
 */
export async function setPreferredLanguage(language: string) {
  if (!hasLocale(routing.locales, language)) return;

  await applyPreferredLanguage(language);

  const client = await createInsForgeServerClient();
  const { data } = await client.auth.getCurrentUser();
  if (!data?.user) return;

  await client.database
    .from("profiles")
    .update({ preferred_language: language })
    .eq("id", data.user.id);
}
