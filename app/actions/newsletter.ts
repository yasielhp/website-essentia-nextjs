"use server";

import { getAdminClient } from "@/lib/insforge-admin";
import {
  ADMIN_ROLES,
  AuthError,
  authenticate,
  requireRole,
} from "@/lib/auth-guard";
import { emailForUnsubscribeToken, setNewsletterState } from "@/lib/newsletter";

/**
 * Three doors onto the newsletter list, one per kind of caller.
 *
 * Signing up is public, because a signup form is. Coming off the list is done
 * with a token, because an email address is not a secret and the old action
 * took one straight from a query string. Staff changing someone else's
 * preference from the dashboard need a role.
 */

/**
 * Adds an address to the list.
 *
 * Public on purpose: this is the form in the site footer, and its caller has
 * no session. The exposure it carries is the one every open signup form has —
 * someone can put an address that is not theirs on the list. Closing that means
 * double opt-in (a confirmation email before the address counts as subscribed),
 * which is a product decision rather than a guard.
 */
// react-doctor-disable-next-line react-doctor/server-auth-actions
export async function subscribeToNewsletter(
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) {
    return { ok: false, error: "invalid" };
  }
  return setNewsletterState(trimmed, true);
}

/** What the unsubscribe page shows before asking for confirmation. */
export async function fetchUnsubscribeEmail(
  token: string,
): Promise<string | null> {
  return emailForUnsubscribeToken(token);
}

/**
 * Takes the holder of this token off the list.
 *
 * The token is the credential — a `gen_random_uuid()` on the contact row,
 * handed out only inside the link — so the address is resolved from it rather
 * than accepted from the caller. That is the whole point: with the address as
 * the argument, anyone could unsubscribe anyone.
 */
// react-doctor-disable-next-line react-doctor/server-auth-actions
export async function unsubscribeByToken(
  token: string,
): Promise<{ ok: boolean; error?: "not_found" | "failed" }> {
  const email = await emailForUnsubscribeToken(token);
  if (!email) return { ok: false, error: "not_found" };

  const result = await setNewsletterState(email, false);
  return result.ok ? { ok: true } : { ok: false, error: "failed" };
}

/** Staff changing a contact's preference from the dashboard. */
export async function setContactNewsletter(
  accessToken: string | null,
  email: string,
  subscribe: boolean,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireRole(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.message };
    throw err;
  }

  return setNewsletterState(email.trim().toLowerCase(), subscribe);
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
    if (caller.userId !== userId && !ADMIN_ROLES.includes(caller.role)) {
      return { ok: false, error: "Insufficient permissions" };
    }
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.message };
    throw err;
  }

  const resendResult = await setNewsletterState(email, subscribe);
  if (!resendResult.ok) return resendResult;

  const { error: dbError } = await getAdminClient()
    .database.from("profiles")
    .update({ newsletter_subscribed: subscribe })
    .eq("id", userId);

  if (dbError) {
    console.error("[newsletter] DB update error:", dbError);
    return { ok: false, error: "Failed to update profile" };
  }

  return { ok: true };
}
