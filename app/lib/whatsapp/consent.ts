/**
 * Where a contact stands on WhatsApp, from the three timestamps on `contacts`.
 *
 * There are two consents because there are two purposes: the booking
 * confirmation and reminder (`whatsapp_opted_in_at`) and news and offers
 * (`whatsapp_marketing_opted_in_at`). The opt-out is a single global stop
 * (`whatsapp_opted_out_at`): a STOP or BAJA reply blocks both uses.
 *
 * Turning a use on clears the STOP, so with a STOP in force it also has to
 * retire what was consented to before it: the other use is set back to NULL
 * and the one turned on gets a new date. Otherwise a consent given months ago
 * would come back to life on someone else's click. `upsert_contact` applies
 * the same rule in SQL (migration 20261117h); keep the two in step.
 *
 * Pure so the dashboard rows and any audience filter read it the same way.
 */
export type WhatsAppPurpose = "appointments" | "marketing";

export type WhatsAppConsentColumns = {
  whatsapp_opted_in_at?: string | null;
  whatsapp_marketing_opted_in_at?: string | null;
  whatsapp_opted_out_at?: string | null;
  /**
   * Not a consent: Meta answered that the number has no WhatsApp. Carried
   * here so one object describes where the contact stands, but it plays no
   * part in `whatsappConsentState`.
   */
  whatsapp_unreachable_at?: string | null;
};

export type WhatsAppConsentState = {
  /** The contact's own STOP/BAJA: no messages for either use. */
  optedOut: boolean;
  /**
   * Whether each use can be messaged right now. A STOP switches both off
   * whatever dates are still stored.
   */
  appointments: "accepted" | "none";
  marketing: "accepted" | "none";
};

type ConsentColumn = "whatsapp_opted_in_at" | "whatsapp_marketing_opted_in_at";

/** The column that holds the opt-in date of a use. */
export function whatsappConsentColumn(purpose: WhatsAppPurpose): ConsentColumn {
  return purpose === "marketing"
    ? "whatsapp_marketing_opted_in_at"
    : "whatsapp_opted_in_at";
}

export function whatsappConsentState(
  contact: WhatsAppConsentColumns,
): WhatsAppConsentState {
  const optedOut = Boolean(contact.whatsapp_opted_out_at);
  return {
    optedOut,
    appointments:
      !optedOut && contact.whatsapp_opted_in_at ? "accepted" : "none",
    marketing:
      !optedOut && contact.whatsapp_marketing_opted_in_at ? "accepted" : "none",
  };
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
    appointments: state.appointments === "accepted",
    marketing: state.marketing === "accepted",
  };
}

/**
 * The columns to write when staff turn one use on.
 *
 * With no STOP in force the use keeps the date it already had (stamped now only
 * if empty) and the other use is not mentioned. With a STOP in force the use
 * gets a new date, the other is withdrawn, and the STOP is cleared either way.
 */
export function whatsappActivationPatch(
  purpose: WhatsAppPurpose,
  current: WhatsAppConsentColumns,
  now: string,
): Partial<Record<ConsentColumn | "whatsapp_opted_out_at", string | null>> {
  const column = whatsappConsentColumn(purpose);
  const other = whatsappConsentColumn(
    purpose === "marketing" ? "appointments" : "marketing",
  );

  if (current.whatsapp_opted_out_at) {
    return { [column]: now, [other]: null, whatsapp_opted_out_at: null };
  }
  return { [column]: current[column] ?? now, whatsapp_opted_out_at: null };
}
