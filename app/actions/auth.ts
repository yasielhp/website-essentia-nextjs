"use server";

import { applyPreferredLanguage } from "./preferred-language";

import { cookies } from "next/headers";
import { createAuthActions } from "@insforge/sdk/ssr";
import { createInsForgeServerClient } from "@/lib/insforge-server";
import { signInSchema, parseErrors } from "@/lib/schemas";
import {
  LOCK_THRESHOLD,
  accountFailures,
  activeLock,
  backoffMs,
  clearLock,
  clientIp,
  createLock,
  findAccount,
  ipOverCeiling,
  recordAuthEvent,
  userAgent,
  wait,
} from "@/lib/auth-security";
import { notifyAccountLocked } from "@/lib/auth-security-notify";

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
  /**
   * The same schema the form runs, run again where it counts.
   *
   * A Server Action is an HTTP endpoint: the browser check is a courtesy to
   * the person typing, not a control. Zod also trims and lowercases the
   * address here, which is what makes the counters below agree with each other
   * — "Ana@x.com" and "ana@x.com " are one account, and were two counters.
   */
  const parsed = signInSchema.safeParse({ email, password });
  if (!parsed.success) {
    return {
      user: null,
      role: null,
      error: {
        code: "invalid" as const,
        fields: parseErrors(signInSchema, { email, password }),
      },
    };
  }

  const address = parsed.data.email;
  const ip = await clientIp();
  const agent = await userAgent();

  /**
   * The connection's allowance, spent before the account's.
   *
   * Without this, five guesses per account is no limit at all: a script walks
   * a list of ten thousand addresses and never touches a ceiling. It is also
   * checked before the lock, so a barrage costs one read rather than two.
   */
  if (await ipOverCeiling(ip)) {
    await recordAuthEvent({
      email: address,
      outcome: "rate_limited",
      ip,
      userAgent: agent,
    });
    return {
      user: null,
      role: null,
      error: { code: "ip_rate_limited" as const },
    };
  }

  if (await activeLock(address)) {
    await recordAuthEvent({
      email: address,
      outcome: "locked",
      ip,
      userAgent: agent,
    });
    return { user: null, role: null, error: { code: "locked" as const } };
  }

  const failures = await accountFailures(address);

  /**
   * The wait comes before the password is checked, not after it fails.
   *
   * Put it after, and a script learns the answer at full speed and only pays
   * for being wrong. Here the fourth guess costs five seconds whether or not
   * it was right.
   */
  await wait(backoffMs(failures));

  const auth = await authActions();
  const { data, error } = await auth.signInWithPassword({
    email: address,
    password: parsed.data.password,
  });

  if (error || !data?.user) {
    // Insforge answers 403 for an account that exists but has not verified its
    // email. That is not a wrong password, so it must not spend an attempt:
    // somebody who never clicked the link would otherwise lock themselves out
    // by trying five times.
    if (error?.statusCode === 403) {
      return { user: null, role: null, error: { code: "unverified" as const } };
    }

    /**
     * The account behind the address, if there is one. Only ever used to tell
     * the two failures apart in the trail and to know where to send the
     * notice — the caller is told the same thing either way.
     */
    const account = await findAccount(address);

    await recordAuthEvent({
      email: address,
      outcome: account ? "bad_password" : "unknown_email",
      userId: account?.id ?? null,
      ip,
      userAgent: agent,
    });

    const total = failures + 1;

    if (total >= LOCK_THRESHOLD) {
      const lock = await createLock(address, total);
      // The notice can only go to an address somebody owns. A lock on an
      // address nobody owns still stands — it is what stops the guessing —
      // it just has no inbox to announce itself to.
      if (lock && account) {
        await notifyAccountLocked(account, total, lock.unlock_token);
      }
      return { user: null, role: null, error: { code: "locked" as const } };
    }

    return {
      user: null,
      role: null,
      error: {
        code: "bad_credentials" as const,
        remaining: LOCK_THRESHOLD - total,
      },
    };
  }

  await recordAuthEvent({
    email: address,
    outcome: "success",
    userId: data.user.id,
    ip,
    userAgent: agent,
  });

  // A correct password ends any lock still standing. The trail keeps the
  // failures that led to it; only the door reopens.
  await clearLock(address);

  /**
   * The role comes back with the sign-in, because the caller needs it
   * immediately to decide where to land — staff and partners go to the
   * dashboard, everyone else to their account.
   *
   * It has to be read here rather than in the browser: the cookies were only
   * just written, and the browser client has no session of its own until the
   * next page load. Asking it sent every partner to `/account`.
   */
  const client = await createInsForgeServerClient();
  const { data: profile } = await client.database
    .from("profiles")
    .select("role, preferred_language")
    .eq("id", data.user.id)
    .maybeSingle();

  await applyPreferredLanguage(
    (profile as { preferred_language?: string } | null)?.preferred_language,
  );

  return {
    user: data.user,
    role: (profile as { role?: string } | null)?.role ?? null,
    error: null,
  };
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

/**
 * Who is signed in, resolved on the server.
 *
 * The browser cannot answer this. `createBrowserClient()` keeps the access
 * token from the cookie but never a user object, so `getCurrentUser()` finds
 * no session in memory after a page load and falls back to the old
 * `*.insforge.app` refresh — the third-party path this whole change exists to
 * escape. It returns null without asking anyone, which read as "signed out"
 * and bounced people straight back to the login.
 *
 * Here the cookie is already at hand, the SDK is in server mode, and the role
 * rides along so the caller does not need a second round-trip for it.
 */
export async function getSessionUser() {
  const client = await createInsForgeServerClient();

  const { data, error } = await client.auth.getCurrentUser();
  if (error || !data?.user) return { user: null, role: null };

  const { data: profile } = await client.database
    .from("profiles")
    .select("role, preferred_language")
    .eq("id", data.user.id)
    .maybeSingle();

  const row = profile as {
    role?: string;
    preferred_language?: string;
  } | null;

  return {
    user: {
      id: data.user.id,
      email: data.user.email,
      name: (data.user.profile as { name?: string } | null)?.name,
    },
    role: row?.role ?? null,
    preferredLanguage: row?.preferred_language ?? null,
  };
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
