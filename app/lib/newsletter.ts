import { Resend } from "resend";
import { getAdminClient } from "@/lib/insforge-admin";

/**
 * The newsletter list, as Resend and the `contacts` table see it.
 *
 * SERVER ONLY, and deliberately not a `"use server"` module: every export of
 * one is a public HTTP endpoint, and these functions take an address and act on
 * it. Callers decide who is allowed — the public page proves intent with a
 * token, the dashboard with a staff role.
 */

const NEWSLETTER_AUDIENCE_ID =
  process.env.RESEND_NEWSLETTER_AUDIENCE_ID ??
  "63633279-d212-4a95-a395-38316b58ec47";

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[newsletter] RESEND_API_KEY not set — skipping Resend");
    return null;
  }
  return new Resend(apiKey);
}

/**
 * Keeps the `contacts` row in step, so new subscribers also appear there.
 *
 * A no is stamped, not just stored as `false`: campaigns may write to clients
 * who were never asked, but never to somebody who asked to be left alone, and
 * only the timestamp tells those two apart. A later yes clears it.
 */
async function syncContactNewsletter(
  email: string,
  subscribed: boolean,
): Promise<void> {
  const now = new Date().toISOString();
  try {
    await getAdminClient()
      .database.from("contacts")
      .upsert(
        {
          email,
          newsletter_subscribed: subscribed,
          newsletter_unsubscribed_at: subscribed ? null : now,
          ...(subscribed ? { newsletter_subscribed_at: now } : {}),
        },
        { onConflict: "email" },
      );
  } catch {
    // fail-open: DB sync failure must not block the subscription
  }
}

export async function setNewsletterState(
  email: string,
  subscribed: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) return { ok: true };

  // Resend upserts by email, so `create` with the flag covers both directions.
  const { error } = await resend.contacts.create({
    audienceId: NEWSLETTER_AUDIENCE_ID,
    email,
    unsubscribed: !subscribed,
  });

  if (error) {
    console.error("[newsletter] Resend error:", error);
    return { ok: false, error: error.message };
  }

  await syncContactNewsletter(email, subscribed);
  return { ok: true };
}

/**
 * The address behind an unsubscribe token, or null.
 *
 * The token is the credential, so this is the only way the public page learns
 * which address it is about — it never takes one from the caller.
 */
export async function emailForUnsubscribeToken(
  token: string,
): Promise<string | null> {
  if (!token) return null;

  const { data } = await getAdminClient()
    .database.from("contacts")
    .select("email")
    .eq("unsubscribe_token", token)
    .maybeSingle();

  return (data as { email: string | null } | null)?.email ?? null;
}
