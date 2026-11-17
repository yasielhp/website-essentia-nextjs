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

/** What the booking form reads to decide whether "news and offers" is already on. */
export type MarketingColumns = WhatsAppConsentColumns & {
  newsletter_subscribed?: boolean | null;
  newsletter_unsubscribed_at?: string | null;
};

/**
 * Whether the single "news and offers by email and WhatsApp" box is already on
 * for this contact: both channels consented, no WhatsApp STOP and no email
 * unsubscribe. With only one of the two it is NOT on, so the box shows unticked
 * and ticking it completes both.
 */
export function marketingConsentActive(contact: MarketingColumns): boolean {
  return (
    contact.newsletter_subscribed === true &&
    !contact.newsletter_unsubscribed_at &&
    whatsappConsentState(contact).marketing === "accepted"
  );
}

/**
 * What the contact page's single "news and offers" switch shows. It is ONE
 * consent for two channels, so it can be in a state neither of them is alone:
 *
 *  - `on`: email AND WhatsApp are on and nobody sent a STOP;
 *  - `off`: neither is;
 *  - `email_only` / `whatsapp_only`: older data, from when they were two
 *    switches. The switch shows off and turning it on completes the other one;
 *  - `opted_out`: the contact's own global STOP, which wins over everything
 *    stored. The switch shows off and turning it on asks first.
 */
export type MarketingRowState =
  "on" | "off" | "email_only" | "whatsapp_only" | "opted_out";

export function marketingRowState(
  contact: MarketingColumns,
): MarketingRowState {
  if (contact.whatsapp_opted_out_at) return "opted_out";
  const email =
    contact.newsletter_subscribed === true &&
    !contact.newsletter_unsubscribed_at;
  const whatsapp = Boolean(contact.whatsapp_marketing_opted_in_at);
  if (email && whatsapp) return "on";
  if (email) return "email_only";
  if (whatsapp) return "whatsapp_only";
  return "off";
}

/** Everything the contact page's consent rows read about one contact. */
export type ContactConsentColumns = MarketingColumns & {
  email?: string | null;
  email_bounced_at?: string | null;
};

/** Why the email half of "news and offers" may not reach this contact. */
export type MarketingNote = "no_email" | "bounced" | "email_unsubscribed";

export function marketingNotes(contact: {
  email?: string | null;
  email_bounced_at?: string | null;
  newsletter_subscribed?: boolean | null;
  newsletter_unsubscribed_at?: string | null;
}): MarketingNote[] {
  if (!contact.email?.trim()) return ["no_email"];
  const notes: MarketingNote[] = [];
  if (contact.email_bounced_at) notes.push("bounced");
  if (
    contact.newsletter_unsubscribed_at &&
    contact.newsletter_subscribed !== true
  ) {
    notes.push("email_unsubscribed");
  }
  return notes;
}

/**
 * How recently a contact must have been written for the booking form to stamp
 * the notice consent on it. The details step has just upserted it; an older row
 * is somebody else's, and a stranger typing an address must not be able to
 * consent on its owner's behalf at any later time.
 */
export const NOTICE_CONSENT_WINDOW_MS = 15 * 60_000;

/** True when the contact was created or updated inside the window, and not in the future. */
export function isContactFresh(
  contact: { created_at?: string | null; updated_at?: string | null },
  now: Date,
): boolean {
  const stamps = [contact.created_at, contact.updated_at]
    .map((value) => (value ? Date.parse(value) : Number.NaN))
    .filter((ms) => Number.isFinite(ms));
  if (stamps.length === 0) return false;
  const age = now.getTime() - Math.max(...stamps);
  return age >= 0 && age <= NOTICE_CONSENT_WINDOW_MS;
}

/**
 * The address the notice consent is stamped on.
 *
 * With a token it is the verified session's and nothing else: if that session
 * has no address, nothing is picked, because falling back to what the browser
 * sent would let a signed-in caller name another person. A guest has no
 * session, so the address of the step she just saved is the only one there is.
 */
export function pickNoticeEmail(input: {
  hasToken: boolean;
  sessionEmail: string | null;
  inputEmail: unknown;
}): string | null {
  const clean = (value: unknown) => {
    if (typeof value !== "string") return null;
    const email = value.trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
  };
  if (input.hasToken) return clean(input.sessionEmail);
  return clean(input.inputEmail);
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
