import { getAdminClient } from "@/lib/insforge-admin";
import { getAppUrl } from "@/lib/env";

/**
 * SERVER ONLY helpers for the consent table. Not a Server Action file: none of
 * these check a role, and exporting them as actions would make them public.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isConsentToken(value: string): boolean {
  return UUID.test(value);
}

/** The link a client opens to sign; Spanish speakers get the Spanish route. */
export function buildConsentUrl(token: string, locale: "en" | "es"): string {
  const base = getAppUrl();
  return locale === "es"
    ? `${base}/es/consentimiento/${token}`
    : `${base}/consent/${token}`;
}

/**
 * The contact's consent row, created on first use, as `{ token, signed }`.
 * A second request racing the first lands on the unique `contact_id` and reads
 * the row the winner made.
 */
export async function ensureConsent(
  contactId: string,
): Promise<{ token: string; signed: boolean } | null> {
  const db = getAdminClient().database;
  const read = async () => {
    const { data } = await db
      .from("contact_consents")
      .select("token, signed_at")
      .eq("contact_id", contactId)
      .maybeSingle();
    return data as { token: string; signed_at: string | null } | null;
  };

  let row = await read();
  if (!row) {
    await db.from("contact_consents").insert([{ contact_id: contactId }]);
    row = await read();
  }
  return row ? { token: row.token, signed: row.signed_at !== null } : null;
}

export type ConsentSubject = {
  consentId: string;
  contactId: string;
  signed: boolean;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  birthdate: string | null;
};

/** What the public page may show, found by the secret token and nothing else. */
export async function loadConsentByToken(
  token: string,
): Promise<ConsentSubject | null> {
  if (!isConsentToken(token)) return null;
  const db = getAdminClient().database;
  const { data } = await db
    .from("contact_consents")
    .select("id, contact_id, signed_at")
    .eq("token", token)
    .maybeSingle();
  const row = data as {
    id: string;
    contact_id: string;
    signed_at: string | null;
  } | null;
  if (!row) return null;

  const { data: contact } = await db
    .from("contacts")
    .select("first_name, last_name, email, phone, birthdate")
    .eq("id", row.contact_id)
    .maybeSingle();
  const c = contact as {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    birthdate: string | null;
  } | null;

  return {
    consentId: row.id,
    contactId: row.contact_id,
    signed: row.signed_at !== null,
    firstName: c?.first_name ?? null,
    lastName: c?.last_name ?? null,
    email: c?.email ?? null,
    phone: c?.phone ?? null,
    birthdate: c?.birthdate ?? null,
  };
}
