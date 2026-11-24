import type { getAdminClient } from "@/lib/insforge-admin";
import type { OwnWhatsAppConsentInput } from "@/types/contact";
import { isContactFresh, marketingConsentActive } from "@/lib/whatsapp/consent";
import { toCampaignPhone } from "@/lib/whatsapp/phone";
import { writeContact } from "@/lib/contacts/write-contact";

type Db = ReturnType<typeof getAdminClient>["database"];

/**
 * Whether the signed-in client already has "news and offers" on for both
 * channels, for the booking form to show the box ticked and locked. Reads only
 * the row of the verified session address and says nothing else about it. No
 * row, or a read that fails, is "not on": the box simply shows unticked.
 */
export async function readOwnMarketing(
  db: Db,
  sessionEmail: string,
): Promise<boolean> {
  const { data, error } = await db
    .from("contacts")
    .select(
      "newsletter_subscribed, newsletter_unsubscribed_at, whatsapp_marketing_opted_in_at, whatsapp_opted_out_at",
    )
    .eq("email", sessionEmail)
    .limit(1);
  const row = (
    data as Parameters<typeof marketingConsentActive>[0][] | null
  )?.[0];
  if (error || !row) return false;
  return marketingConsentActive(row);
}

/**
 * Writes a signed-in client's contact from the booking form, and her choice on
 * "news and offers".
 *
 * `sessionEmail` comes from the verified session, never from the browser, so
 * the only contact this can touch is the caller's. It is written the PUBLIC
 * way (`writeContact`, decided by the owner on 2026-11-24): a contact she does
 * not have yet is created with what she typed; the one she has keeps its
 * name, phone and language (the booking row keeps what she typed), and only
 * gains the "news and offers" yes she ticks, the newsletter and WhatsApp
 * marketing together, never over a STOP or an unsubscribe of hers. Unticked
 * is `null` and touches nothing. Its `updated_at` is touched, which is what
 * lets the notice consent that follows land on it.
 */
export async function recordOwnWhatsAppConsent(
  db: Db,
  sessionEmail: string,
  input: OwnWhatsAppConsentInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = await writeContact(
    db,
    {
      email: sessionEmail,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      language: input.language,
      gender: null,
      newsletter: input.marketing ? true : null,
      whatsappMarketing: input.marketing ? true : null,
    },
    "public",
  );
  return id ? { ok: true } : { ok: false, error: "db" };
}

/**
 * Accepting the Terms and the Privacy Policy on the booking form is what lets
 * the confirmation and the reminder of the appointment go out on WhatsApp.
 * This records it: `whatsapp_opted_in_at = now`, and nothing else.
 *
 * Four limits, each one a way this could be abused or could do harm:
 *  - the contact must exist and have been written in the last 15 minutes, so
 *    it can only be the row the details step has just saved (a stranger cannot
 *    consent for an address by typing it later);
 *  - its phone must be the one typed in the form (as numbers, E.164): the
 *    notices go to the CONTACT's number (`clientPhone`), so a stranger who
 *    types somebody's address with her own phone cannot consent for that
 *    person's number, and an existing contact whose number differs gets no
 *    consent from the form (the public way never rewrites the number);
 *  - the update itself only touches a row with no consent yet AND no STOP, so a
 *    contact who wrote BAJA is not reactivated by booking again, whatever
 *    happened between the read and the write;
 *  - it never changes the STOP, the marketing consent or any other column.
 *
 * Does not look at the phone suppression list: every send reads it itself.
 */
export async function stampBookingNoticeConsent(
  db: Db,
  email: string,
  phone: string | null,
  now: Date,
): Promise<{ ok: true; stamped: boolean } | { ok: false; error: "db" }> {
  const typed = toCampaignPhone(phone);
  if (!typed) return { ok: true, stamped: false };

  const { data, error } = await db
    .from("contacts")
    .select("id, created_at, updated_at, phone")
    .eq("email", email)
    .limit(1);
  if (error) return { ok: false, error: "db" };

  const row = (
    data as
      | {
          id: string;
          created_at: string | null;
          updated_at: string | null;
          phone: string | null;
        }[]
      | null
  )?.[0];
  if (!row || !isContactFresh(row, now)) return { ok: true, stamped: false };
  if (toCampaignPhone(row.phone) !== typed) {
    return { ok: true, stamped: false };
  }

  const { data: written, error: writeError } = await db
    .from("contacts")
    .update({ whatsapp_opted_in_at: now.toISOString() })
    .eq("id", row.id)
    .is("whatsapp_opted_in_at", null)
    .is("whatsapp_opted_out_at", null)
    .select("id");
  if (writeError) return { ok: false, error: "db" };
  return { ok: true, stamped: ((written ?? []) as unknown[]).length > 0 };
}
