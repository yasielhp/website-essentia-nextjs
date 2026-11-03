"use server";

import { AuthError, requireRole } from "@/lib/auth-guard";
import { getAdminClient } from "@/lib/insforge-admin";
import { sendEmail } from "@/emails/send";
import { consentRequestEmail } from "@/emails/templates/consent-request";
import { consentSchema, type ConsentInput } from "@/lib/schemas";
import { missingRequired, sanitizeAnswers } from "@/lib/consent/fields";
import { signatureSource } from "@/lib/consent/signature";
import {
  appendHistory,
  consentState,
  historyEntryFrom,
  type ConsentSnapshot,
} from "@/lib/consent/history";
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

type Validated = {
  input: ConsentInput;
  answers: Record<string, boolean | string>;
  /** The drawn signature, or null when the submission carries none. */
  bytes: Buffer | null;
};

/** Everything that can be checked without touching the database. */
function validateSubmission(
  rawInput: unknown,
): { error: string } | { ok: Validated } {
  const parsed = consentSchema.safeParse(rawInput);
  if (!parsed.success) return { error: "invalid" };
  const input = parsed.data;

  const answers = sanitizeAnswers(input.data);
  if (missingRequired(answers).length > 0) return { error: "incomplete" };

  // Whether a signature must be there is decided later, against the row.
  if (!input.signaturePng) return { ok: { input, answers, bytes: null } };

  const bytes = Buffer.from(
    input.signaturePng.slice("data:image/png;base64,".length),
    "base64",
  );
  if (bytes.length > MAX_PNG_BYTES) return { error: "tooLarge" };
  if (!PNG_MAGIC.every((b, i) => bytes[i] === b)) return { error: "invalid" };

  return { ok: { input, answers, bytes } };
}

const SNAPSHOT_FIELDS =
  "id, signed_at, signed_name, data, image_consent, health_data_consent, signature_path, filled_by_role, version, history";

type ConsentRow = ConsentSnapshot & { id: string; history: unknown };

/** The form asks for what the contact is missing; it never overwrites what the centre has. */
async function fillMissingContactDetails(
  contactId: string,
  input: ConsentInput,
): Promise<void> {
  if (!input.birthdate && !input.phone) return;
  const db = getAdminClient().database;
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

/**
 * Validates a submission, stores the signature in the private bucket and seals
 * the consent row. Shared by the public form and the desk.
 *
 * `consentId` is already resolved by the caller (from a secret token, or from a
 * staff member's authenticated request); nothing here reads anything but that
 * one row.
 *
 * Two modes. `first` seals a row that is not signed: the update is conditioned
 * on `signed_at IS NULL`, so the first signature stands even if two requests
 * race. `replace` is for a desk correcting a signed consent: one update that
 * moves the signed state into `history` and writes the new one together,
 * conditioned on the version it read, so there is never a moment with no
 * signature, nothing earlier is lost, and the earlier file stays in the bucket.
 * A correction may draw no new signature: the one on record is kept and
 * nothing is uploaded. A first signing always needs one.
 */
async function sealConsent(
  consentId: string,
  contactId: string,
  rawInput: unknown,
  filledByRole: string,
  mode: "first" | "replace" = "first",
): Promise<SaveResult> {
  const checked = validateSubmission(rawInput);
  if ("error" in checked) return { error: checked.error };
  const { input, answers, bytes } = checked.ok;

  const admin = getAdminClient();
  const db = admin.database;

  const { data: existing } = await db
    .from("contact_consents")
    .select(SNAPSHOT_FIELDS)
    .eq("id", consentId)
    .maybeSingle();
  const row = existing as ConsentRow | null;
  if (!row) return { error: "invalid" };
  if (mode === "first" && row.signed_at) return { error: "alreadySigned" };
  if (mode === "replace" && !row.signed_at) return { error: "invalid" };

  const source = signatureSource(
    mode,
    bytes !== null,
    row.signed_at ? row.signature_path : null,
  );
  if (source.use === "none") return { error: "incomplete" };

  let path = row.signature_path as string;
  const uploaded = source.use === "new" && bytes !== null;
  if (uploaded) {
    path = `${contactId}/${Date.now()}.png`;
    const { error: uploadError } = await admin.storage
      .from("consents")
      .upload(path, new Blob([new Uint8Array(bytes)], { type: "image/png" }));
    if (uploadError) {
      console.error("[consent] signature upload failed:", uploadError);
      return { error: "generic" };
    }
  }

  const now = new Date().toISOString();
  const sealed = {
    data: answers,
    image_consent: input.imageConsent,
    health_data_consent: input.healthDataConsent,
    signature_path: path,
    signed_at: now,
    signed_name: input.signedName,
    filled_by_role: filledByRole,
    updated_at: now,
  };

  const entry = mode === "replace" ? historyEntryFrom(row) : null;
  const update =
    mode === "replace" && entry
      ? db
          .from("contact_consents")
          .update({
            ...sealed,
            history: appendHistory(row.history, entry),
            version: row.version + 1,
          })
          .eq("id", consentId)
          .eq("version", row.version)
          .not("signed_at", "is", null)
      : db
          .from("contact_consents")
          .update(sealed)
          .eq("id", consentId)
          .is("signed_at", null);
  const { data: written, error } = await update.select("id");

  if (error || ((written ?? []) as unknown[]).length === 0) {
    // Lost the race, or the write failed: do not leave an orphan signature.
    // A kept signature is the record's own file and is never removed.
    if (uploaded) await admin.storage.from("consents").remove(path);
    return {
      error: error
        ? "generic"
        : mode === "replace"
          ? "conflict"
          : "alreadySigned",
    };
  }
  if (mode === "replace") {
    console.info("[consent] replaced a signed consent", {
      contactId,
      version: row.version + 1,
    });
  }

  await fillMissingContactDetails(contactId, input);
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

/**
 * Somebody at the centre fills it in with the client, in the dashboard.
 *
 * `replace` is for correcting a consent that is already signed: the earlier
 * signing is kept in `history` and the new one takes its place. Without it, a
 * signed consent is refused, as it is for the public link.
 */
export async function submitConsentAsStaff(
  accessToken: string | null,
  contactId: string,
  input: unknown,
  options?: { replace?: boolean },
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
  return sealConsent(
    id,
    contactId,
    input,
    role,
    consent.signed && options?.replace ? "replace" : "first",
  );
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
 * A contact's consent, with the signature read from the private bucket.
 * Dashboard only. Null while there is nothing to show: no answers and no
 * signature. A consent that was reopened for a new signature comes back with
 * `signedAt: null` and its previous answers, so the desk can see — and
 * pre-fill from — what is waiting to be signed again.
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
    .select(SNAPSHOT_FIELDS)
    .eq("contact_id", contactId)
    .maybeSingle();
  const row = data as ConsentRow | null;
  if (!row || consentState(row) === "none") return null;

  // The bucket is private: the file is read here with the service key and
  // handed over inline, so no link to the signature ever exists to leak.
  let signatureDataUrl: string | null = null;
  if (row.signed_at && row.signature_path) {
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
 * Asks a client who already signed to sign again: the signed state moves to
 * `history` and the consent counts as not signed until they do.
 *
 * One update, conditioned on the version just read and on the row still being
 * signed, so two people pressing it at once reopen it once. The answers stay
 * (they pre-fill the next signing), the token stays (the old link works), the
 * signature file stays in the bucket. Dashboard only.
 */
export async function reopenConsent(
  accessToken: string | null,
  contactId: string,
): Promise<{
  error: "forbidden" | "not_signed" | "conflict" | "failed" | null;
}> {
  try {
    await requireRole(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return { error: "forbidden" };
    throw err;
  }
  if (!contactId) return { error: "failed" };

  const db = getAdminClient().database;
  const { data } = await db
    .from("contact_consents")
    .select(SNAPSHOT_FIELDS)
    .eq("contact_id", contactId)
    .maybeSingle();
  const row = data as ConsentRow | null;
  const entry = row ? historyEntryFrom(row) : null;
  if (!row || !entry) return { error: "not_signed" };

  const { data: updated, error } = await db
    .from("contact_consents")
    .update({
      history: appendHistory(row.history, entry),
      signed_at: null,
      signature_path: null,
      signed_name: null,
      filled_by_role: null,
      version: row.version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("version", row.version)
    .not("signed_at", "is", null)
    .select("id");
  if (error) return { error: "failed" };
  if (((updated ?? []) as unknown[]).length === 0) return { error: "conflict" };

  // The fact, never the answers: they are health data.
  console.info("[consent] reopened for a new signature", {
    contactId,
    version: row.version + 1,
  });
  return { error: null };
}

/**
 * "Resend": reopens a signed consent and emails the client the link to sign it
 * again. Checks there is an address first, so a contact with nobody to write to
 * is not left with a consent reopened for nothing. Dashboard only.
 */
export async function resendConsent(
  accessToken: string | null,
  contactId: string,
): Promise<{
  error: "forbidden" | "no_email" | "not_signed" | "conflict" | "failed" | null;
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
    .select("email")
    .eq("id", contactId)
    .maybeSingle();
  if (!(data as { email: string | null } | null)?.email) {
    return { error: "no_email" };
  }

  const reopened = await reopenConsent(accessToken, contactId);
  if (reopened.error) return { error: reopened.error };

  const sent = await sendConsentEmail(accessToken, contactId);
  // "signed" cannot happen right after reopening; anything else is a failure
  // to deliver, and the consent stays reopened for the desk to resend.
  return sent.error === null
    ? { error: null, email: sent.email }
    : { error: sent.error === "no_email" ? "no_email" : "failed" };
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
