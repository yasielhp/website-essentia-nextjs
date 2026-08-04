import {
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

/**
 * Normalising and displaying the two contact fields that arrive in every shape
 * imaginable.
 *
 * The existing rows mix uppercase emails with phone numbers written as `+34…`,
 * `0034…` and bare national numbers from four different countries, so neither
 * field can be trusted to be presentable as stored. Formatting happens at the
 * edges: on display, and on the way into the database for new writes. Stored
 * rows are left untouched.
 */

/** Assumed when a number carries no country information of its own. */
const DEFAULT_COUNTRY: CountryCode = "ES";

/** Lowercased and trimmed, or `null` when there is nothing left. */
export function normalizeEmail(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

/** Display form for an email. Falls back to a dash for empty values. */
export function displayEmail(value: string | null | undefined): string {
  return normalizeEmail(value) ?? "—";
}

/**
 * Parses a number, but only hands one back when it is actually valid.
 *
 * The validity check is what stops a foreign national number from being
 * mangled: `07889630071` is a UK number written without a country code, and
 * assuming Spain turns it into the nonsense `+34 07889630071`. Rejecting it
 * here means the original text is shown untouched instead.
 */
function parse(value: string | null | undefined) {
  if (!value?.trim()) return null;
  // `parsePhoneNumberFromString` understands the `00` international prefix and
  // national formats, provided it knows which country to assume.
  const parsed = parsePhoneNumberFromString(value.trim(), DEFAULT_COUNTRY);
  return parsed?.isValid() ? parsed : null;
}

/**
 * Canonical `+CC…` form for storage. Returns the trimmed input unchanged when
 * the number cannot be parsed — refusing to store what the user typed would be
 * worse than storing it unformatted.
 */
export function normalizePhone(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return parse(trimmed)?.number ?? trimmed;
}

/**
 * Grouped international form, e.g. `+34 686 13 39 67`.
 * Unparseable values are shown as typed rather than hidden.
 */
export function displayPhone(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return "—";
  return parse(trimmed)?.formatInternational() ?? trimmed;
}

/** Whether a value is a phone number some country would accept. */
export function isValidPhone(value: string | null | undefined): boolean {
  return parse(value) !== null;
}
