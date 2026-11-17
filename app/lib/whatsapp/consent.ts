/**
 * Where a contact stands on WhatsApp, from the two timestamps on `contacts`.
 *
 * Pure so the dashboard row and any future audience filter read it the same
 * way. The rule it encodes is the one the database and the webhook already
 * keep: ticking the box (or the admin toggle) stamps `whatsapp_opted_in_at` and
 * clears `whatsapp_opted_out_at`; only a STOP/BAJA reply or the admin toggle
 * ever sets the opt-out. So a non-empty opt-out always means "currently out".
 */
export type WhatsAppConsentState = "accepted" | "opted_out" | "none";

export type WhatsAppConsentColumns = {
  whatsapp_opted_in_at?: string | null;
  whatsapp_opted_out_at?: string | null;
};

export function whatsappConsentState(
  contact: WhatsAppConsentColumns,
): WhatsAppConsentState {
  if (contact.whatsapp_opted_out_at) return "opted_out";
  if (contact.whatsapp_opted_in_at) return "accepted";
  return "none";
}
