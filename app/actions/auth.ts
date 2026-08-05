"use server";

import { cookies } from "next/headers";
import { createAuthActions } from "@insforge/sdk/ssr";
import { createInsForgeServerClient } from "@/lib/insforge-server";

/**
 * The auth mutations, run where the cookies can be written.
 *
 * The refresh token is httpOnly and belongs to this domain, so anything that
 * establishes or clears a session has to happen on the server. The browser
 * client keeps only the read side (`getCurrentUser`, `getProfile`).
 *
 * `createAuthActions()` covers signing in, signing up, verifying and signing
 * out. The password-reset and resend-verification calls it does not wrap go
 * through `createServerClient()`, which exposes the full auth surface; none of
 * them establishes a session, so nothing is lost by that route.
 *
 * Only async functions are exported from this file: a `"use server"` module
 * that exports a type or a constant compiles fine and then crashes at runtime.
 */

async function authActions() {
  return createAuthActions({ cookies: await cookies() });
}

/** The SDK's error, flattened to something a Client Component can receive. */
function toPlainError(error: { message?: string; statusCode?: number } | null) {
  if (!error) return null;
  return {
    message: error.message ?? "Something went wrong",
    statusCode: error.statusCode ?? 500,
  };
}

export async function signInWithPassword(email: string, password: string) {
  const auth = await authActions();
  const { data, error } = await auth.signInWithPassword({ email, password });

  return { user: data?.user ?? null, error: toPlainError(error) };
}

export async function signUp(email: string, password: string, name: string) {
  const auth = await authActions();
  const { data, error } = await auth.signUp({ email, password, name });

  return {
    user: data?.user ?? null,
    // The tokens never reach the browser; this flag is what the form needs to
    // know whether the account is live or waiting on a code.
    requireEmailVerification: data?.requireEmailVerification ?? false,
    error: toPlainError(error),
  };
}

export async function verifyEmail(email: string, otp: string) {
  const auth = await authActions();
  const { data, error } = await auth.verifyEmail({ email, otp });

  return { user: data?.user ?? null, error: toPlainError(error) };
}

export async function signOut() {
  const auth = await authActions();
  await auth.signOut();

  return { ok: true };
}

export async function resendVerificationEmail(
  email: string,
  redirectTo: string,
) {
  const client = await createInsForgeServerClient();
  const { error } = await client.auth.resendVerificationEmail({
    email,
    redirectTo,
  });

  return { ok: !error, error: toPlainError(error) };
}

export async function sendResetPasswordEmail(
  email: string,
  redirectTo: string,
) {
  const client = await createInsForgeServerClient();
  const { error } = await client.auth.sendResetPasswordEmail({
    email,
    redirectTo,
  });

  return { ok: !error, error: toPlainError(error) };
}

/**
 * Exchanges the emailed code and sets the new password in one call.
 *
 * The two steps were separate in the browser, which meant the short-lived
 * token from the first one travelled back down to the page. Keeping both on
 * the server means it never leaves.
 */
export async function resetPassword(
  email: string,
  otp: string,
  newPassword: string,
) {
  const client = await createInsForgeServerClient();

  const { data, error: exchangeError } =
    await client.auth.exchangeResetPasswordToken({ email, code: otp });

  if (exchangeError || !data?.token) {
    return { ok: false, stage: "exchange", error: toPlainError(exchangeError) };
  }

  const { error: resetError } = await client.auth.resetPassword({
    newPassword,
    otp: data.token,
  });

  if (resetError) {
    return { ok: false, stage: "reset", error: toPlainError(resetError) };
  }

  return { ok: true, stage: null, error: null };
}
