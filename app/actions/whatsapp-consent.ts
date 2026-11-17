"use server";

import { z } from "zod";
import { getAdminClient } from "@/lib/insforge-admin";
import { AuthError, authenticate } from "@/lib/auth-guard";
import { pickNoticeEmail } from "@/lib/whatsapp/consent";
import {
  readOwnMarketing,
  recordOwnWhatsAppConsent,
  stampBookingNoticeConsent,
} from "@/lib/whatsapp/self-consent";
import { normalizeEmail } from "@/utils/contact";

const inputSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().max(120),
  phone: z.string().trim().min(6).max(40),
  language: z.enum(["en", "es"]),
  marketing: z.boolean(),
});

const noticeSchema = z.object({
  // A literal, not a boolean: the call only means something when she did.
  termsAccepted: z.literal(true),
  // Only a guest's address. A signed-in caller's is the session's, always.
  email: z.unknown().optional(),
});

/**
 * Whether the signed-in client already has "news and offers" on for email and
 * WhatsApp, so the booking form can show the box ticked instead of asking
 * again. Answers "not on" to anyone it cannot identify and never throws: the
 * form works the same without it.
 */
export async function fetchOwnMarketingOn(
  accessToken: string | null,
): Promise<boolean> {
  try {
    const email = normalizeEmail((await authenticate(accessToken)).email);
    if (!email) return false;
    return await readOwnMarketing(getAdminClient().database, email);
  } catch {
    return false;
  }
}

/**
 * A signed-in client's contact, written from the booking form.
 *
 * A guest's details reach `upsert_contact` straight from the browser; a client
 * with a session never had a contact written there, so without this she would
 * have no row for her choice on "news and offers", nor for the booking notices
 * that accepting the Terms allows. The contact is found by the address on the
 * verified session, not by anything the browser sends: the action can only
 * ever change the caller's own record. Any signed-in role may call it, since
 * staff book appointments too.
 */
export async function saveOwnWhatsAppConsent(
  accessToken: string | null,
  input: unknown,
): Promise<{ ok: boolean; error?: string }> {
  let email: string | null;
  try {
    email = normalizeEmail((await authenticate(accessToken)).email);
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.message };
    throw err;
  }
  if (!email) return { ok: false, error: "noEmail" };

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    return await recordOwnWhatsAppConsent(
      getAdminClient().database,
      email,
      parsed.data,
    );
  } catch {
    return { ok: false, error: "db" };
  }
}

/**
 * Accepting the Terms and the Privacy Policy on the booking form is what allows
 * the confirmation and the reminder of the appointment on WhatsApp. This
 * records it on the contact the details step has just saved.
 *
 * Public on purpose, like the form it serves: a guest has no session. What
 * bounds it is `stampBookingNoticeConsent` (a contact written in the last 15
 * minutes, with no consent and no STOP yet) and that a signed-in caller's
 * address comes from her verified session, never from the browser. It never
 * lifts a STOP and never throws: if it fails the booking goes on and the only
 * loss is the WhatsApp notice. Bookings the team makes from the dashboard do
 * not come through here, so they record no consent.
 */
// react-doctor-disable-next-line react-doctor/server-auth-actions
export async function recordBookingNoticeConsent(
  accessToken: string | null,
  input: unknown,
): Promise<{ ok: boolean; stamped?: boolean; error?: string }> {
  const parsed = noticeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "terms" };

  let sessionEmail: string | null = null;
  if (accessToken) {
    try {
      sessionEmail = normalizeEmail((await authenticate(accessToken)).email);
    } catch {
      return { ok: false, error: "auth" };
    }
  }

  const email = pickNoticeEmail({
    hasToken: Boolean(accessToken),
    sessionEmail,
    inputEmail: parsed.data.email,
  });
  if (!email) return { ok: false, error: "noEmail" };

  try {
    return await stampBookingNoticeConsent(
      getAdminClient().database,
      email,
      new Date(),
    );
  } catch {
    return { ok: false, error: "db" };
  }
}
