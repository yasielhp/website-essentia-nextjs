/**
 * Shared formatting helpers.
 *
 * Date and price formatting was previously re-implemented inline in more than a
 * dozen dashboard pages and email templates, each with slightly different
 * options. These helpers keep one definition per output shape.
 *
 * All date helpers take an ISO `YYYY-MM-DD` string and build the Date from its
 * components, so the rendered day never shifts because of the UTC offset.
 */

export type SupportedLocale = "en" | "es";

const intlLocale = (locale: SupportedLocale) =>
  locale === "es" ? "es-ES" : "en-GB";

/** Parses `YYYY-MM-DD` into a local-time Date. Returns null when malformed. */
export function parseIsoDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `Monday, 20 May 2026` — used in client-facing booking emails. */
export function formatBookingDate(
  dateStr: string,
  locale: SupportedLocale = "en",
): string {
  const date = parseIsoDate(dateStr);
  if (!date) return dateStr;
  return date.toLocaleDateString(intlLocale(locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** `20 May 2026` — used in payment confirmations. */
export function formatLongDate(
  dateStr: string,
  locale: SupportedLocale = "en",
): string {
  const date = parseIsoDate(dateStr);
  if (!date) return dateStr;
  return date.toLocaleDateString(intlLocale(locale), {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** `20/05/2026` — compact form for dense dashboard tables. */
export function formatShortDate(
  dateStr: string | null | undefined,
  locale: SupportedLocale = "es",
): string {
  const date = parseIsoDate(dateStr);
  if (!date) return "—";
  return date.toLocaleDateString(intlLocale(locale), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Formats a timestamp (not a plain date) for dashboard listings. */
export function formatDateTime(
  timestamp: string | null | undefined,
  locale: SupportedLocale = "es",
): string {
  if (!timestamp) return "—";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(intlLocale(locale), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** `1.234,50 €` in Spanish, `€1,234.50` in English. */
export function formatPrice(
  amount: number | null | undefined,
  locale: SupportedLocale = "es",
): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

/** Extracts the minutes from strings like `"45 min"`, falling back to 60. */
export function parseDurationMinutes(
  duration: string | null | undefined,
  fallback = 60,
): number {
  if (!duration) return fallback;
  return parseInt(duration.replace(/\D/g, ""), 10) || fallback;
}

/** Adds `minutes` to an `HH:MM` string and returns the resulting `HH:MM`. */
export function addMinutesToTime(time: string, minutes: number): string {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  const total = hour * 60 + minute + minutes;
  const endHour = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const endMinute = (total % 60).toString().padStart(2, "0");
  return `${endHour}:${endMinute}`;
}
