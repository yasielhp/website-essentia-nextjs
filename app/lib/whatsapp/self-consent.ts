import type { getAdminClient } from "@/lib/insforge-admin";
import type { OwnWhatsAppConsentInput } from "@/types/contact";
import { isContactFresh, marketingConsentActive } from "@/lib/whatsapp/consent";

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
 * the only contact this can touch is the caller's. It goes through the same
 * `upsert_contact` as a guest booking, which is also what makes the row exist
 * and be fresh for the notice consent that follows it: a ticked box turns on
 * the newsletter and WhatsApp marketing together (clearing an earlier STOP, as
 * for a guest), an unticked one is sent as `null` and touches nothing. The
 * address is passed lowercased; `contacts` lowercases emails on write, so it
 * lands on the row she already has.
 */
export async function recordOwnWhatsAppConsent(
  db: Db,
  sessionEmail: string,
  input: OwnWhatsAppConsentInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await db.rpc("upsert_contact", {
    p_email: sessionEmail,
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_phone: input.phone,
    p_language: input.language,
    p_gender: null,
    p_newsletter: input.marketing ? true : null,
    p_whatsapp: null,
    p_whatsapp_marketing: input.marketing ? true : null,
  });
  if (error || !data) return { ok: false, error: "db" };
  return { ok: true };
}

/**
 * Accepting the Terms and the Privacy Policy on the booking form is what lets
 * the confirmation and the reminder of the appointment go out on WhatsApp.
 * This records it: `whatsapp_opted_in_at = now`, and nothing else.
 *
 * Three limits, each one a way this could be abused or could do harm:
 *  - the contact must exist and have been written in the last 15 minutes, so
 *    it can only be the row the details step has just saved (a stranger cannot
 *    consent for an address by typing it later);
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
  now: Date,
): Promise<{ ok: true; stamped: boolean } | { ok: false; error: "db" }> {
  const { data, error } = await db
    .from("contacts")
    .select("id, created_at, updated_at")
    .eq("email", email)
    .limit(1);
  if (error) return { ok: false, error: "db" };

  const row = (
    data as
      | { id: string; created_at: string | null; updated_at: string | null }[]
      | null
  )?.[0];
  if (!row || !isContactFresh(row, now)) return { ok: true, stamped: false };

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
