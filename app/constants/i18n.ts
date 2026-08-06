/**
 * Name of the cookie that carries the dashboard's language preference.
 *
 * Deliberately NOT `NEXT_LOCALE`: that is the cookie next-intl's middleware
 * (`proxy.ts`) reads to pick the public site's locale, so reusing it would
 * make a staff member switching the dashboard to Spanish also redirect `/` to
 * `/es` for their own browsing. The two preferences are separate — the public
 * site takes its locale from the `[locale]` path segment, and the dashboard,
 * which lives outside that segment, keeps its own.
 */
export const LOCALE_COOKIE = "DASHBOARD_LOCALE";

/** One year, in seconds — how long the preference survives. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
