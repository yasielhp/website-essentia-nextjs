import type { getAdminClient } from "@/lib/insforge-admin";
import { normalizeEmail } from "@/utils/contact";

/**
 * How a contact is written, by who is writing it. SERVER ONLY (the service
 * key is handed in), and pure in what it decides.
 *
 * An email address is not a secret. Whoever types one into a public form, or
 * into a form she reaches with a client's session, may not be the person it
 * belongs to, so what she typed must not land on somebody else's record. Three
 * ways, decided by the owner on 2026-11-24:
 *
 *  - `overwrite`: the team (admin and staff), who have the client in front of
 *    them. `upsert_contact` as it always was: the name, the phone and the
 *    language are the ones given, a ticked consent is stamped and lifts an
 *    earlier no (CLAUDE.md, "WhatsApp consent rule").
 *  - `public`: everything a person does without proving the address (the
 *    booking form, a run or course registration, a bonus bought online) and a
 *    client's own session on the booking form. A NEW contact is created with
 *    what she typed, as it always was. An EXISTING one keeps its name, phone,
 *    language and gender; it only GAINS a consent she gives ("news and
 *    offers": the newsletter, WhatsApp marketing) and never one that was
 *    withdrawn: a STOP (`whatsapp_opted_out_at`) or an unsubscribe
 *    (`newsletter_unsubscribed_at`) stays. Its `updated_at` is touched, so the
 *    booking-notice consent that follows sees the row the step has just
 *    written (`stampBookingNoticeConsent`, which also asks for the same
 *    phone). Never the booking-notice consent itself.
 *  - `link`: a partner at the desk, and the team confirming a booking (whose
 *    details somebody else typed). A new contact is created as given; an
 *    existing one is only found, never changed.
 *
 * The phone typed always stays on the BOOKING row, where the team sees it.
 */

type Db = ReturnType<typeof getAdminClient>["database"];

export type ContactMode = "overwrite" | "public" | "link";

/** What a contact is written with; `null` consents touch nothing. */
export type ContactWrite = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  /** `null` leaves a new contact with the column's default. */
  language: string | null;
  gender: string | null;
  newsletter: true | null;
  whatsappMarketing: true | null;
};

/** The consent columns of an existing contact, as the public way reads them. */
export type ExistingContact = {
  id: string;
  newsletter_subscribed: boolean | null;
  newsletter_unsubscribed_at: string | null;
  whatsapp_marketing_opted_in_at: string | null;
  whatsapp_opted_out_at: string | null;
};

const EXISTING_COLUMNS =
  "id, newsletter_subscribed, newsletter_unsubscribed_at, whatsapp_marketing_opted_in_at, whatsapp_opted_out_at";

/**
 * What the public way adds to an existing contact: a consent she gives, only
 * where there is no withdrawal of it. Nothing else, ever.
 */
export function publicConsentPatch(
  existing: ExistingContact,
  given: Pick<ContactWrite, "newsletter" | "whatsappMarketing">,
  nowIso: string,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (
    given.newsletter === true &&
    !existing.newsletter_unsubscribed_at &&
    existing.newsletter_subscribed !== true
  ) {
    patch.newsletter_subscribed = true;
    patch.newsletter_subscribed_at = nowIso;
  }
  if (
    given.whatsappMarketing === true &&
    !existing.whatsapp_opted_out_at &&
    !existing.whatsapp_marketing_opted_in_at
  ) {
    patch.whatsapp_marketing_opted_in_at = nowIso;
  }
  return patch;
}

/** The row a new contact is inserted as: what was given, as `upsert_contact` inserts it. */
export function newContactRow(
  email: string,
  contact: ContactWrite,
  nowIso: string,
): Record<string, unknown> {
  return {
    email,
    first_name: contact.firstName || null,
    last_name: contact.lastName || null,
    phone: contact.phone,
    ...(contact.language ? { preferred_language: contact.language } : {}),
    gender: contact.gender,
    newsletter_subscribed: contact.newsletter === true,
    newsletter_subscribed_at: contact.newsletter === true ? nowIso : null,
    whatsapp_marketing_opted_in_at:
      contact.whatsappMarketing === true ? nowIso : null,
  };
}

/** A unique violation: the address was written by somebody else meanwhile. */
export function isDuplicate(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  return (
    code === "23505" ||
    (typeof message === "string" &&
      /contacts_email_key|duplicate key/.test(message))
  );
}

/** `upsert_contact` with the service key: the team's way. Its id, or null. */
export async function upsertContact(
  db: Db,
  contact: ContactWrite,
): Promise<string | null> {
  try {
    const { data, error } = await db.rpc("upsert_contact", {
      p_email: contact.email,
      p_first_name: contact.firstName,
      p_last_name: contact.lastName,
      p_phone: contact.phone,
      p_language: contact.language,
      p_gender: contact.gender,
      p_newsletter: contact.newsletter,
      // The booking-notice consent is never a form's to send here.
      p_whatsapp: null,
      p_whatsapp_marketing: contact.whatsappMarketing,
    });
    if (error || typeof data !== "string" || !data) return null;
    return data;
  } catch {
    return null;
  }
}

async function readExisting(
  db: Db,
  email: string,
): Promise<ExistingContact | null | "failed"> {
  const { data, error } = await db
    .from("contacts")
    .select(EXISTING_COLUMNS)
    .eq("email", email)
    .maybeSingle();
  if (error) return "failed";
  return (data as ExistingContact | null) ?? null;
}

/**
 * Writes the contact the way `mode` allows (see above) and answers its id, or
 * null when the database did not answer. Never throws.
 */
export async function writeContact(
  db: Db,
  contact: ContactWrite,
  mode: ContactMode,
  now: () => Date = () => new Date(),
): Promise<string | null> {
  if (mode === "overwrite") return upsertContact(db, contact);
  try {
    // `contacts` lowercases and trims an address on write; it is read so.
    const email = normalizeEmail(contact.email);
    if (!email) return null;
    const nowIso = now().toISOString();

    let existing = await readExisting(db, email);
    if (existing === "failed") return null;
    if (!existing) {
      const { data, error } = await db
        .from("contacts")
        .insert([newContactRow(email, contact, nowIso)])
        .select("id")
        .single();
      const id = (data as { id?: string } | null)?.id;
      if (!error && id) return id;
      // Written by another call between the read and the insert: from here
      // it is an existing contact like any other, and nothing is overwritten.
      if (!isDuplicate(error)) return null;
      existing = await readExisting(db, email);
      if (existing === "failed" || !existing) return null;
    }

    if (mode === "link") return existing.id;

    const { error } = await db
      .from("contacts")
      .update({
        ...publicConsentPatch(existing, contact, nowIso),
        updated_at: nowIso,
      })
      .eq("id", existing.id);
    // The contact is hers either way: a consent that did not land is logged,
    // and the booking keeps its link.
    if (error)
      console.error("[contact] the consent could not be added:", error);
    return existing.id;
  } catch (err) {
    console.error("[contact] the contact could not be written:", err);
    return null;
  }
}
