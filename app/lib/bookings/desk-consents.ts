/**
 * A contact as the desk's "New booking" offers it, with the two consents of
 * its switches already read (pure: no database, usable in the browser). The
 * search itself is `desk-contact-search.ts`, on the server.
 */

/** A consent as the desk reads it: given, not given, or withdrawn by the person. */
export type DeskConsentState = "on" | "off" | "stopped";

export type DeskContactOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: string | null;
  language: "en" | "es";
  appointmentNotices: DeskConsentState;
  marketing: DeskConsentState;
};

export type DeskConsentColumns = {
  newsletter_subscribed: boolean | null;
  newsletter_unsubscribed_at: string | null;
  whatsapp_opted_in_at: string | null;
  whatsapp_marketing_opted_in_at: string | null;
  whatsapp_opted_out_at: string | null;
};

export type DeskContactRow = DeskConsentColumns & {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  gender: string | null;
  preferred_language: string | null;
};

export const DESK_CONTACT_COLUMNS =
  "id, first_name, last_name, email, phone, gender, preferred_language, newsletter_subscribed, newsletter_unsubscribed_at, whatsapp_opted_in_at, whatsapp_marketing_opted_in_at, whatsapp_opted_out_at";

/**
 * The two consents as the desk shows them. A STOP (`whatsapp_opted_out_at`)
 * withdraws both; an email unsubscribe withdraws "news and offers". Only the
 * person, or her card's own switch with its question, lifts a withdrawal: the
 * desk never does.
 */
export function deskConsents(columns: DeskConsentColumns): {
  appointmentNotices: DeskConsentState;
  marketing: DeskConsentState;
} {
  const stopped = Boolean(columns.whatsapp_opted_out_at);
  return {
    appointmentNotices: stopped
      ? "stopped"
      : columns.whatsapp_opted_in_at
        ? "on"
        : "off",
    marketing:
      stopped || columns.newsletter_unsubscribed_at
        ? "stopped"
        : columns.newsletter_subscribed === true &&
            columns.whatsapp_marketing_opted_in_at
          ? "on"
          : "off",
  };
}

export function toDeskOption(row: DeskContactRow): DeskContactOption | null {
  const email = row.email?.trim();
  if (!email) return null;
  return {
    id: row.id,
    firstName: row.first_name ?? "",
    lastName: row.last_name ?? "",
    email,
    phone: row.phone ?? "",
    gender: row.gender,
    language: row.preferred_language === "en" ? "en" : "es",
    ...deskConsents(row),
  };
}
