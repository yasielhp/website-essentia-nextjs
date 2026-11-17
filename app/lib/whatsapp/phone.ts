/**
 * Phone numbers, as Meta and the database want them.
 *
 * PURE, and it imports nothing: a client component of the dashboard loads this
 * file, and whatever it imported would travel to the browser with it. It used
 * to take `toE164` out of `client.ts`, which put the whole Meta client in the
 * bundle. `client.ts` now takes it from here instead (a test keeps it so).
 */

/** The pattern `campaign_recipients.phone` is checked against in the database. */
const CAMPAIGN_PHONE = /^\+[0-9]{8,15}$/;

/**
 * Spanish mobile numbers are written half a dozen ways in a profile form —
 * `600 11 22 33`, `600-112-233`, `0034600112233`. Meta accepts only E.164, so
 * the number is reduced to digits and given the Spanish prefix when it carries
 * none. A number that is already international keeps its own country code.
 */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const hasPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  if (!hasPlus) {
    // `00` is the other way of writing `+` on this side of the Atlantic.
    if (digits.startsWith("00")) digits = digits.slice(2);
    else if (digits.length === 9) digits = `34${digits}`;
  }

  // Shorter than this is a landline extension or a typo, not a mobile.
  if (digits.length < 8) return null;
  return `+${digits}`;
}

/**
 * The number a campaign can send to: `toE164` plus the database's own check.
 *
 * `toE164` is lenient on purpose (it serves staff notices), but a campaign row
 * with a number the CHECK constraint refuses would abort the whole batch. A
 * contact whose number does not fit is simply left out of the audience.
 */
export function toCampaignPhone(raw: string | null | undefined): string | null {
  const phone = toE164(raw);
  return phone !== null && CAMPAIGN_PHONE.test(phone) ? phone : null;
}
