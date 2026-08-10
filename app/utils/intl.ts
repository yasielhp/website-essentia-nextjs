/**
 * Formatters, built once per locale-and-options pair.
 *
 * `new Intl.DateTimeFormat(...)` is not a cheap object: it resolves the locale
 * and compiles a pattern. Building one inside a function means paying for that
 * on every call — once per row of a table, or seven times to name the days of
 * a week — and throwing it away each time.
 *
 * They cannot simply be hoisted to module scope, because the locale is not
 * known until render. A map keyed by both is the same idea, one step later.
 */
const dateFormatters = new Map<string, Intl.DateTimeFormat>();
const numberFormatters = new Map<string, Intl.NumberFormat>();

export function dateFormatter(
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = dateFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    dateFormatters.set(key, formatter);
  }
  return formatter;
}

export function numberFormatter(
  locale: string,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = numberFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    numberFormatters.set(key, formatter);
  }
  return formatter;
}
