/**
 * Which contacts own a phone number, whatever way it was typed in.
 *
 * Pure, so the webhook only reads and writes.
 */

import { toCampaignPhone } from "@/lib/whatsapp/phone";

/**
 * The ids of the contacts whose phone is one of the senders' numbers.
 *
 * Phones are stored however a form wrote them (`600 11 22 33`, `600-112-233`,
 * `0034600112233`), so SQL cannot match them reliably; each is normalised and
 * compared here. A sender is Meta's `messages[].from`, digits only and without
 * the `+`; one that is not a usable number matches nothing. Contacts are
 * indexed by number once, so any number of senders costs a single pass.
 *
 * `normalise` decides what a usable number is. The default is the one campaigns
 * send to; the opt-out passes the more lenient `toE164`, so a STOP is never
 * refused over a number the campaigns would not have used.
 */
export function matchByPhone(
  from: string | readonly string[],
  contacts: { id: string; phone: string | null }[],
  normalise: (raw: string | null) => string | null = toCampaignPhone,
): string[] {
  const byPhone = new Map<string, string[]>();
  for (const contact of contacts) {
    const phone = normalise(contact.phone);
    if (!phone) continue;
    const ids = byPhone.get(phone);
    if (ids) ids.push(contact.id);
    else byPhone.set(phone, [contact.id]);
  }

  const matched = new Set<string>();
  for (const sender of typeof from === "string" ? [from] : from) {
    if (typeof sender !== "string") continue;
    const digits = sender.replace(/\D/g, "");
    if (!digits) continue;
    // Always with the `+`, so the Spanish prefix is never added to it.
    const phone = normalise(`+${digits}`);
    for (const id of (phone && byPhone.get(phone)) || []) matched.add(id);
  }
  return [...matched];
}
