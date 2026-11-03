"use server";

import { AuthError, requireRole } from "@/lib/auth-guard";
import { getAdminClient } from "@/lib/insforge-admin";
import { sendEmail } from "@/emails/send";
import { consentRequestEmail } from "@/emails/templates/consent-request";
import { consentSchema } from "@/lib/schemas";
import { missingRequired, sanitizeAnswers } from "@/lib/consent/fields";
import type { ContactConsent } from "@/types/consent";
import {
  buildConsentUrl,
  ensureConsent,
  isConsentToken,
} from "@/lib/consent/server";

/** A signature larger than this is not a signature. */
const MAX_PNG_BYTES = 300 * 1024;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

type SaveResult = { error: string | null };

/**
 * Validates a submission, stores the signature in the private bucket and seals
 * the consent row. Shared by the public form and the desk.
 *
 * `consentId` is already resolved by the caller (from a secret token, or from a
 * staff member's authenticated request); nothing here reads anything but that
 * one row. The final update is conditioned on `signed_at IS NULL`, so the first
 * signature stands even if two requests race.
 */
async function sealConsent(
  consentId: string,
  contactId: string,
  rawInput: unknown,
  filledByRole: string,
): Promise<SaveResult> {
  const parsed = consentSchema.safeParse(rawInput);
  if (!parsed.success) return { error: "invalid" };
  const input = parsed.data;

  const answers = sanitizeAnswers(input.data);
  if (missingRequired(answers).length > 0) return { error: "incomplete" };

  const bytes = Buffer.from(
    input.signaturePng.slice("data:image/png;base64,".length),
    "base64",
  );
  if (bytes.length > MAX_PNG_BYTES) return { error: "tooLarge" };
  if (!PNG_MAGIC.every((b, i) => bytes[i] === b)) return { error: "invalid" };

  const admin = getAdminClient();
  const db = admin.database;

  const { data: existing } = await db
    .from("contact_consents")
    .select("signed_at")
    .eq("id", consentId)
    .maybeSingle();
  if (!existing) return { error: "invalid" };
  if ((existing as { signed_at: string | null }).signed_at) {
    return { error: "alreadySigned" };
  }

  const path = `${contactId}/${Date.now()}.png`;
  const { error: uploadError } = await admin.storage
    .from("consents")
    .upload(path, new Blob([bytes], { type: "image/png" }));
  if (uploadError) {
    console.error("[consent] signature upload failed:", uploadError);
    return { error: "generic" };
  }

  const { data: sealed, error } = await db
    .from("contact_consents")
    .update({
      data: answers,
      image_consent: input.imageConsent,
      health_data_consent: input.healthDataConsent,
      signature_path: path,
      signed_at: new Date().toISOString(),
      signed_name: input.signedName,
      filled_by_role: filledByRole,
      updated_at: new Date().toISOString(),
    })
    .eq("id", consentId)
    .is("signed_at", null)
    .select("id");
  if (error || ((sealed ?? []) as unknown[]).length === 0) {
    // Lost the race, or the write failed: do not leave an orphan signature.
    await admin.storage.from("consents").remove(path);
    return { error: error ? "generic" : "alreadySigned" };
  }

  // The form asks for what the contact is missing; it never overwrites what
  // the centre already has.
  if (input.birthdate || input.phone) {
    const { data: contact } = await db
      .from("contacts")
      .select("birthdate, phone")
      .eq("id", contactId)
      .maybeSingle();
    const c = contact as {
      birthdate: string | null;
      phone: string | null;
    } | null;
    const patch: Record<string, string> = {};
    if (input.birthdate && !c?.birthdate) patch.birthdate = input.birthdate;
    if (input.phone && !c?.phone) patch.phone = input.phone.trim();
    if (Object.keys(patch).length > 0) {
      await db.from("contacts").update(patch).eq("id", contactId);
    }
  }

  return { error: null };
}

/**
 * The client signs from the link in their email.
 *
 * Public on purpose: the unguessable token in the link is the only credential,
 * and it resolves to exactly one consent row.
 */
// react-doctor-disable-next-line react-doctor/server-auth-actions
export async function submitConsent(
  token: string,
  input: unknown,
): Promise<SaveResult> {
  if (!isConsentToken(token)) return { error: "invalid" };
  const { data } = await getAdminClient()
    .database.from("contact_consents")
    .select("id, contact_id")
    .eq("token", token)
    .maybeSingle();
  const row = data as { id: string; contact_id: string } | null;
  if (!row) return { error: "invalid" };
  return sealConsent(row.id, row.contact_id, input, "client");
}

/** Somebody at the centre fills it in with the client, in the dashboard. */
export async function submitConsentAsStaff(
  accessToken: string | null,
  contactId: string,
  input: unknown,
): Promise<SaveResult> {
  let role: string;
  try {
    role = (await requireRole(accessToken)).role;
  } catch (err) {
    if (err instanceof AuthError) return { error: "forbidden" };
    throw err;
  }
  const consent = await ensureConsent(contactId);
  if (!consent) return { error: "generic" };
  const { data } = await getAdminClient()
    .database.from("contact_consents")
    .select("id")
    .eq("token", consent.token)
    .maybeSingle();
  const id = (data as { id: string } | null)?.id;
  if (!id) return { error: "generic" };
  return sealConsent(id, contactId, input, role);
}

/**
 * The link to send a client, creating their consent row if there is none yet.
 * Dashboard only.
 */
export async function createConsentLink(
  accessToken: string | null,
  contactId: string,
): Promise<{ url: string | null; signed: boolean }> {
  try {
    await requireRole(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return { url: null, signed: false };
    throw err;
  }
  if (!contactId) return { url: null, signed: false };

  const consent = await ensureConsent(contactId);
  if (!consent) return { url: null, signed: false };

  const { data } = await getAdminClient()
    .database.from("contacts")
    .select("preferred_language")
    .eq("id", contactId)
    .maybeSingle();
  const locale =
    (data as { preferred_language: string | null } | null)
      ?.preferred_language === "en"
      ? "en"
      : "es";
  return {
    url: buildConsentUrl(consent.token, locale),
    signed: consent.signed,
  };
}

/**
 * A contact's signed consent, with the signature read from the private bucket.
 * Dashboard only. Null while it is unsigned.
 */
export async function fetchContactConsent(
  accessToken: string | null,
  contactId: string,
): Promise<ContactConsent | null> {
  try {
    await requireRole(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return null;
    throw err;
  }
  if (!contactId) return null;

  const admin = getAdminClient();
  const { data } = await admin.database
    .from("contact_consents")
    .select(
      "data, image_consent, health_data_consent, signature_path, signed_at, signed_name, filled_by_role",
    )
    .eq("contact_id", contactId)
    .maybeSingle();
  const row = data as {
    data: Record<string, boolean | string> | null;
    image_consent: boolean;
    health_data_consent: boolean;
    signature_path: string | null;
    signed_at: string | null;
    signed_name: string | null;
    filled_by_role: string | null;
  } | null;
  if (!row?.signed_at) return null;

  // The bucket is private: the file is read here with the service key and
  // handed over inline, so no link to the signature ever exists to leak.
  let signatureDataUrl: string | null = null;
  if (row.signature_path) {
    const { data: blob } = await admin.storage
      .from("consents")
      .download(row.signature_path);
    if (blob) {
      const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
      signatureDataUrl = `data:image/png;base64,${base64}`;
    }
  }

  return {
    signedAt: row.signed_at,
    signedName: row.signed_name,
    imageConsent: row.image_consent,
    healthDataConsent: row.health_data_consent,
    answers: row.data ?? {},
    signatureDataUrl,
    filledByRole: row.filled_by_role,
  };
}

/**
 * Emails the client the link to fill in their consent, creating their consent
 * row if there is none. Dashboard only. Refuses when there is nobody to write
 * to or the consent is already signed: a second link would only confuse them.
 */
export async function sendConsentEmail(
  accessToken: string | null,
  contactId: string,
): Promise<{
  error: "forbidden" | "no_email" | "signed" | "failed" | null;
  email?: string;
}> {
  try {
    await requireRole(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return { error: "forbidden" };
    throw err;
  }

  const { data } = await getAdminClient()
    .database.from("contacts")
    .select("email, first_name, preferred_language")
    .eq("id", contactId)
    .maybeSingle();
  const contact = data as {
    email: string | null;
    first_name: string | null;
    preferred_language: string | null;
  } | null;
  if (!contact?.email) return { error: "no_email" };

  const consent = await ensureConsent(contactId);
  if (!consent) return { error: "failed" };
  if (consent.signed) return { error: "signed" };

  const locale = contact.preferred_language === "en" ? "en" : "es";
  const { error } = await sendEmail({
    to: contact.email,
    subject:
      locale === "es"
        ? "Completa tu consentimiento informado · Essentia"
        : "Complete your informed consent · Essentia",
    html: consentRequestEmail({
      name: contact.first_name?.trim() || "",
      url: buildConsentUrl(consent.token, locale),
      locale,
    }),
  });
  return error ? { error: "failed" } : { error: null, email: contact.email };
}
