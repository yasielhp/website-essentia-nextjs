/**
 * Where a contact stands on WhatsApp, from the three timestamps on `contacts`.
 *
 * There are two consents because there are two purposes: the booking
 * confirmation and reminder (`whatsapp_opted_in_at`) and news and offers
 * (`whatsapp_marketing_opted_in_at`). Each is held or not on its own. The
 * opt-out is a single global stop (`whatsapp_opted_out_at`): a STOP or BAJA
 * reply blocks both uses and leaves the two dates as history. Ticking either
 * public checkbox, or staff turning a use on, clears it.
 *
 * Pure so the dashboard rows and any audience filter read it the same way.
 */
export type WhatsAppPurpose = "appointments" | "marketing";

export type WhatsAppConsentColumns = {
  whatsapp_opted_in_at?: string | null;
  whatsapp_marketing_opted_in_at?: string | null;
  whatsapp_opted_out_at?: string | null;
};

export type WhatsAppConsentState = {
  /** The contact's own STOP/BAJA: no messages for either use. */
  optedOut: boolean;
  /** Whether each use has been consented to, whatever `optedOut` says. */
  appointments: "accepted" | "none";
  marketing: "accepted" | "none";
};

/** The column that holds the opt-in date of a use. */
export function whatsappConsentColumn(
  purpose: WhatsAppPurpose,
): "whatsapp_opted_in_at" | "whatsapp_marketing_opted_in_at" {
  return purpose === "marketing"
    ? "whatsapp_marketing_opted_in_at"
    : "whatsapp_opted_in_at";
}

/**
 * Which uses can be messaged right now: consent given and no STOP since.
 * What the booking form shows a signed-in client as "already on".
 */
export function activeWhatsAppUses(contact: WhatsAppConsentColumns): {
  appointments: boolean;
  marketing: boolean;
} {
  const state = whatsappConsentState(contact);
  return {
    appointments: !state.optedOut && state.appointments === "accepted",
    marketing: !state.optedOut && state.marketing === "accepted",
  };
}

export function whatsappConsentState(
  contact: WhatsAppConsentColumns,
): WhatsAppConsentState {
  return {
    optedOut: Boolean(contact.whatsapp_opted_out_at),
    appointments: contact.whatsapp_opted_in_at ? "accepted" : "none",
    marketing: contact.whatsapp_marketing_opted_in_at ? "accepted" : "none",
  };
}
