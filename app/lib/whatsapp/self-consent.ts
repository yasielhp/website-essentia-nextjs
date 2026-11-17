import type { getAdminClient } from "@/lib/insforge-admin";
import type { OwnWhatsAppConsentInput, OwnWhatsAppUses } from "@/types/contact";
import { activeWhatsAppUses } from "@/lib/whatsapp/consent";

type Db = ReturnType<typeof getAdminClient>["database"];

/**
 * Which uses the contact of this address already has on, for the booking form
 * to show as already active. Reads only the caller's own row, found by the
 * verified session address, and says nothing else about it. No row, or a read
 * that fails, is "nothing on": the box simply shows unticked.
 */
export async function readOwnWhatsAppUses(
  db: Db,
  sessionEmail: string,
): Promise<OwnWhatsAppUses> {
  const { data, error } = await db
    .from("contacts")
    .select(
      "whatsapp_opted_in_at, whatsapp_marketing_opted_in_at, whatsapp_opted_out_at",
    )
    .eq("email", sessionEmail)
    .limit(1);
  const row = (data as Parameters<typeof activeWhatsAppUses>[0][] | null)?.[0];
  if (error || !row) return { appointments: false, marketing: false };
  return activeWhatsAppUses(row);
}

/**
 * Records a signed-in client's WhatsApp consent on her own contact.
 *
 * `sessionEmail` comes from the verified session, never from the browser, so
 * the only contact this can touch is the caller's. It goes through the same
 * `upsert_contact` as a guest booking: a ticked use stamps its date once and
 * clears an earlier STOP, a use that is not ticked is sent as `null` and
 * touches nothing, and a client with no contact row yet gets one. The address
 * is passed lowercased; `contacts` lowercases emails on write, so it lands on
 * the row she already has.
 */
export async function recordOwnWhatsAppConsent(
  db: Db,
  sessionEmail: string,
  input: OwnWhatsAppConsentInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.appointments && !input.marketing) return { ok: true };

  const { data, error } = await db.rpc("upsert_contact", {
    p_email: sessionEmail,
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_phone: input.phone,
    p_language: input.language,
    p_gender: null,
    p_newsletter: null,
    p_whatsapp: input.appointments ? true : null,
    p_whatsapp_marketing: input.marketing ? true : null,
  });
  if (error || !data) return { ok: false, error: "db" };
  return { ok: true };
}
