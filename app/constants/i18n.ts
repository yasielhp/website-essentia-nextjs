/**
 * The cookie that carries a person's language, everywhere.
 *
 * `NEXT_LOCALE` is what next-intl's middleware (`proxy.ts`) already reads to
 * pick the public site's locale, so the dashboard reads the same one rather
 * than keeping a second cookie of its own: a staff member who sets the panel
 * to Spanish meets the site in Spanish too, which is what they asked for.
 *
 * The cookie is not the source of truth — `profiles.preferred_language` is.
 * This is only how a single request finds out about it without a database
 * round-trip, and how the site remembers a language for a visitor who never
 * signs in.
 */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** One year, in seconds — how long the preference survives. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
