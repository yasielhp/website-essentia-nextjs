"use server";

import { z } from "zod";
import { getAdminClient } from "@/lib/insforge-admin";
import { ADMIN_ROLES, AuthError, authenticate } from "@/lib/auth-guard";
import {
  emailForUnsubscribeToken,
  setNewsletterState,
  subscribeUnlessUnsubscribed,
} from "@/lib/newsletter";

/**
 * An address as it reaches these doors: anything at all, because a Server
 * Action is a public HTTP endpoint and its arguments are whatever the caller
 * posted. Not exported: a `"use server"` module exports async functions only.
 */
const emailInput = z.string().trim().toLowerCase().max(160).pipe(z.email());

/**
 * Doors onto the newsletter list, one per kind of caller.
 *
 * Signing up is public, because a signup form is. Coming off the list is done
 * with a token, because an email address is not a secret and the old action
 * took one straight from a query string. A signed-in client changes her own
 * preference with her session. Staff changing a contact's consent from the
 * dashboard use `setMarketingConsent`, which also records the WhatsApp half.
 */

/**
 * Adds an address to the list.
 *
 * Public on purpose: this is the form in the site footer, and its caller has
 * no session. The exposure it carries is the one every open signup form has —
 * someone can put an address that is not theirs on the list. Closing that means
 * double opt-in (a confirmation email before the address counts as subscribed),
 * which is a product decision rather than a guard. What it never does is take
 * back an unsubscribe: an address that asked to be left alone stays off the
 * list, and the answer is the same as for any other, so it does not tell a
 * stranger which addresses unsubscribed.
 */
// react-doctor-disable-next-line react-doctor/server-auth-actions
export async function subscribeToNewsletter(
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  // Parsed, not trusted to be a string: `email.trim()` on what is not one
  // threw, and a thrown action is a 500 instead of the form's own error.
  const parsed = emailInput.safeParse(email);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const result = await subscribeUnlessUnsubscribed(parsed.data);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
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

/**
 * Flips the newsletter preference on a profile.
 *
 * Requires the caller to be the profile owner or an administrator; without the
 * check any visitor could toggle the preference of an arbitrary user id.
 *
 * The ADDRESS is not the caller's to choose either. Checking the user id and
 * then acting on the `email` argument let any signed-in client unsubscribe, or
 * subscribe again, whoever she named. So whoever changes her own preference
 * does it on the address of her auth session (`verifiedEmail`), and the
 * argument is ignored; the account page sends her own, so nothing changes for
 * it. Not `caller.email`: that one prefers `profiles.email`, a column she can
 * rewrite from the browser, which would bring the same hole back in two steps.
 * Only an administrator acting on ANOTHER user names the address, which must
 * be one.
 */
export async function updateNewsletterForUser(
  accessToken: string | null,
  userId: string,
  email: string,
  subscribe: boolean,
): Promise<{ ok: boolean; error?: string }> {
  let address: string;
  try {
    const caller = await authenticate(accessToken);
    const own = caller.userId === userId;
    if (!own && !ADMIN_ROLES.includes(caller.role)) {
      return { ok: false, error: "Insufficient permissions" };
    }
    const parsed = emailInput.safeParse(own ? caller.verifiedEmail : email);
    if (!parsed.success) return { ok: false, error: "invalid" };
    address = parsed.data;
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.message };
    throw err;
  }
  if (typeof userId !== "string" || typeof subscribe !== "boolean") {
    return { ok: false, error: "invalid" };
  }

  const resendResult = await setNewsletterState(address, subscribe);
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
