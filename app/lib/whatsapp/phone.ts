import { toE164 } from "./client";

/** The pattern `campaign_recipients.phone` is checked against in the database. */
const CAMPAIGN_PHONE = /^\+[0-9]{8,15}$/;

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
