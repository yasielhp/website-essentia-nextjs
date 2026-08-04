"use server";

import { Resend } from "resend";
import { getAdminClient } from "@/lib/insforge-admin";
import { AuthError, authenticate } from "@/lib/auth-guard";

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

async function syncContactNewsletter(
  email: string,
  subscribed: boolean,
): Promise<void> {
  try {
    // Upsert the contact so new subscribers also appear in the contacts table
    await getAdminClient()
      .database.from("contacts")
      .upsert(
        { email, newsletter_subscribed: subscribed },
        { onConflict: "email" },
      );
  } catch {
    // fail-open: DB sync failure must not block the subscription
  }
}

export async function subscribeToNewsletter(
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) return { ok: true };

  const { error } = await resend.contacts.create({
    audienceId: NEWSLETTER_AUDIENCE_ID,
    email,
    unsubscribed: false,
  });

  if (error) {
    console.error("[newsletter] subscribe error:", error);
    return { ok: false, error: error.message };
  }

  await syncContactNewsletter(email, true);
  return { ok: true };
}

export async function unsubscribeFromNewsletter(
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) return { ok: true };

  // Resend upserts by email: calling create with unsubscribed:true marks the contact
  const { error } = await resend.contacts.create({
    audienceId: NEWSLETTER_AUDIENCE_ID,
    email,
    unsubscribed: true,
  });

  if (error) {
    console.error("[newsletter] unsubscribe error:", error);
    return { ok: false, error: error.message };
  }

  await syncContactNewsletter(email, false);
  return { ok: true };
}

/**
 * Flips the newsletter preference on a profile.
 *
 * Requires the caller to be the profile owner or an administrator; without the
 * check any visitor could toggle the preference of an arbitrary user id.
 */
export async function updateNewsletterForUser(
  accessToken: string | null,
  userId: string,
  email: string,
  subscribe: boolean,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const caller = await authenticate(accessToken);
    if (caller.userId !== userId && caller.role !== "admin") {
      return { ok: false, error: "Insufficient permissions" };
    }
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.message };
    throw err;
  }

  const resendResult = subscribe
    ? await subscribeToNewsletter(email)
    : await unsubscribeFromNewsletter(email);

  if (!resendResult.ok) return resendResult;

  const adminClient = getAdminClient();

  const { error: dbError } = await adminClient.database
    .from("profiles")
    .update({ newsletter_subscribed: subscribe })
    .eq("id", userId);

  if (dbError) {
    console.error("[newsletter] DB update error:", dbError);
    return { ok: false, error: "Failed to update profile" };
  }

  return { ok: true };
}
