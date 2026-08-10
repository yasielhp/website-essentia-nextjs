/**
 * Shared formatting helpers.
 *
 * Date and price formatting was previously re-implemented inline in more than a
 * dozen dashboard pages and email templates, each with slightly different
 * options. These helpers keep one definition per output shape.
 *
 * All date helpers take an ISO `YYYY-MM-DD` string and build the Date from its
 * components, so the rendered day never shifts because of the UTC offset.
 *
 * Every helper also names its locale *and* its time zone. Leaving either out
 * makes the output depend on the machine doing the formatting: Node renders a
 * page on the server in whatever `TZ` the host was started with, the browser
 * re-renders it in the visitor's own, and React then reports a hydration
 * mismatch and throws the server's markup away. Naming both keeps the two
 * sides byte-identical.
 */

export type SupportedLocale = "en" | "es";

/** The centre is in Tenerife; every appointment it schedules happens there. */
export const TIME_ZONE = "Atlantic/Canary";

const intlLocale = (locale: SupportedLocale) =>
  locale === "es" ? "es-ES" : "en-GB";

/**
 * Parses `YYYY-MM-DD` into a Date pinned to midnight UTC. Returns null when
 * malformed.
 *
 * UTC rather than local time on purpose: the plain-date helpers below format
 * with `timeZone: "UTC"`, and the pair together is what makes a date come out
 * as the same day everywhere. Building at local midnight instead would push
 * the date back a day for anyone east of Greenwich.
 */
export function parseIsoDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
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
    timeZone: "UTC",
  });
}

/**
 * Formats a `Date` that stands for a calendar day somebody picked — the day in
 * a date picker, not an instant on a timeline.
 *
 * Such a Date carries the browser's own midnight, so handing it straight to
 * `toLocaleDateString` with an explicit zone can roll it over to the day
 * before or after. Re-anchoring to midday UTC first and formatting in UTC
 * gives twelve hours of slack on either side, which no time zone on earth can
 * cross, so the day printed is always the day chosen.
 */
export function formatCalendarDay(
  date: Date,
  locale: SupportedLocale,
  options: Intl.DateTimeFormatOptions,
): string {
  const midday = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12),
  );
  return midday.toLocaleDateString(intlLocale(locale), {
    ...options,
    timeZone: "UTC",
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
    timeZone: "UTC",
  });
}
/**
 * `May 20, 2026` / `20 may 2026` — the listing format shared by the users,
 * members and contact detail screens, which each carried a byte-identical copy
 * of this function. Takes a timestamp, not a plain date.
 */
export function formatMediumDate(
  iso: string | null | undefined,
  locale: SupportedLocale = "en",
): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(intlLocale(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: TIME_ZONE,
  });
}

/** `14:30` — the clock time of a timestamp, without the date. */
export function formatTimeOfDay(
  iso: string | null | undefined,
  locale: SupportedLocale = "en",
): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(intlLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
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

/**
 * The calendar date of a `Date`, as the person looking at it sees it.
 *
 * `toISOString().slice(0, 10)` is the trap this replaces. A day picked in a
 * calendar is built as `new Date(year, month, day)` — local midnight — and in
 * any timezone ahead of UTC that instant belongs to the previous day in UTC.
 * The Canaries are UTC+1 in summer, so a visitor choosing Monday had Sunday
 * written to their booking, while the availability check beside it read
 * Monday. Read the fields the calendar set, not a UTC projection of them.
 */
export function localDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
