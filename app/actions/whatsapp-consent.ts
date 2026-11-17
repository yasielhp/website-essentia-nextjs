"use server";

import { z } from "zod";
import { getAdminClient } from "@/lib/insforge-admin";
import { AuthError, authenticate } from "@/lib/auth-guard";
import { recordOwnWhatsAppConsent } from "@/lib/whatsapp/self-consent";
import { normalizeEmail } from "@/utils/contact";

const inputSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().max(120),
  phone: z.string().trim().min(6).max(40),
  language: z.enum(["en", "es"]),
  appointments: z.boolean(),
  marketing: z.boolean(),
});

/**
 * A signed-in client ticking WhatsApp on the booking form.
 *
 * A guest's boxes reach `upsert_contact` straight from the browser; a client
 * with a session never had a contact written there, so the choice came here
 * and would otherwise have been lost. The contact is found by the address on
 * the verified session, not by anything the browser sends: the action can only
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
