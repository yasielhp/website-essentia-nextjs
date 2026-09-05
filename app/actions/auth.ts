"use server";

import { applyPreferredLanguage } from "./preferred-language";

import { cookies } from "next/headers";
import { createAuthActions } from "@insforge/sdk/ssr";
import { createInsForgeServerClient } from "@/lib/insforge-server";
import {
  signInSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  signUpSchema,
  verifyEmailSchema,
  parseErrors,
} from "@/lib/schemas";
import { getAppUrl } from "@/lib/env";
import { getAdminClient } from "@/lib/insforge-admin";
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
  codeFailures,
  codeRequests,
  codeRequestsFromIp,
  userAgent,
  wait,
  signupsFromIp,
  CODE_ATTEMPTS,
  CODE_REQUEST_IP_LIMIT,
  CODE_REQUEST_LIMIT,
  SIGNUP_IP_LIMIT,
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

export async function signUp(
  email: string,
  password: string,
  name: string,
  newsletter = false,
) {
  const parsed = signUpSchema.safeParse({ email, password, name });
  if (!parsed.success) {
    return {
      user: null,
      requireEmailVerification: false,
      error: {
        code: "invalid" as const,
        fields: parseErrors(signUpSchema, { email, password, name }),
      },
    };
  }

  const address = parsed.data.email;
  const ip = await clientIp();
  const agent = await userAgent();

  /**
   * Capping the resend button alone would close nothing: this form sends the
   * very same verification email, so an attacker would simply register the
   * victim's address over and over instead of pressing resend. Counted per
   * address for that, and per connection for the account farm.
   */
  const [byAddress, byConnection] = await Promise.all([
    codeRequests("verify", address),
    signupsFromIp(ip),
  ]);

  if (byAddress >= CODE_REQUEST_LIMIT || byConnection >= SIGNUP_IP_LIMIT) {
    await recordAuthEvent({
      email: address,
      outcome: "signup_throttled",
      ip,
      userAgent: agent,
    });
    return {
      user: null,
      requireEmailVerification: false,
      error: { code: "throttled" as const },
    };
  }

  const auth = await authActions();
  const { data, error } = await auth.signUp({
    email: address,
    password: parsed.data.password,
    name: parsed.data.name ?? "",
  });

  if (error || !data?.user) {
    return {
      user: null,
      requireEmailVerification: false,
      // The one thing worth telling apart: an address already registered is a
      // person who should be signing in, not an error to shrug at.
      error: {
        code: (error?.statusCode === 409 ? "email_taken" : "generic") as
          "email_taken" | "generic",
      },
    };
  }

  // Two rows, because the sign-up spends both budgets: one account from this
  // connection, and one verification email to this address.
  await recordAuthEvent({
    email: address,
    outcome: "signup_attempt",
    userId: data.user.id,
    ip,
    userAgent: agent,
  });
  await recordAuthEvent({
    email: address,
    outcome: "verify_requested",
    userId: data.user.id,
    ip,
    userAgent: agent,
  });

  // Consent lands on the contact row, which is what campaigns read. The
  // profile may not exist yet — the browser creates it after this returns — so
  // it is not touched here. Best effort: bookkeeping must never fail a sign-up.
  if (newsletter) {
    try {
      await getAdminClient()
        .database.from("contacts")
        .upsert(
          {
            email: address,
            first_name: parsed.data.name?.trim().split(/\s+/)[0] || null,
            newsletter_subscribed: true,
            newsletter_subscribed_at: new Date().toISOString(),
          },
          { onConflict: "email" },
        );
    } catch (err) {
      console.error("[signUp] could not record newsletter consent:", err);
    }
  }

  return {
    user: data.user,
    // The tokens never reach the browser; this flag is what the form needs to
    // know whether the account is live or waiting on a code.
    requireEmailVerification: data.requireEmailVerification ?? false,
    error: null,
  };
}

export async function verifyEmail(email: string, otp: string) {
  const parsed = verifyEmailSchema.safeParse({ email, otp });
  if (!parsed.success) {
    return {
      user: null,
      error: {
        code: "invalid" as const,
        fields: parseErrors(verifyEmailSchema, { email, otp }),
      },
    };
  }

  const address = parsed.data.email;
  const ip = await clientIp();
  const agent = await userAgent();

  /**
   * The same six digits and the same million guesses as the reset, and it was
   * open for the same reason: nothing counted. Less valuable to reach — this
   * one verifies an address rather than choosing a password — but it is the
   * step that turns a registration into a live account, so it is worth no less
   * than five tries.
   */
  const failures = await codeFailures("verify", address);

  if (failures >= CODE_ATTEMPTS) {
    await recordAuthEvent({
      email: address,
      outcome: "verify_throttled",
      ip,
      userAgent: agent,
    });
    return {
      user: null,
      error: { code: "throttled" as const, reason: "attempts" as const },
    };
  }

  await wait(backoffMs(failures));

  const auth = await authActions();
  const { data, error } = await auth.verifyEmail({
    email: address,
    otp: parsed.data.otp,
  });

  if (error || !data?.user) {
    await recordAuthEvent({
      email: address,
      outcome: "verify_bad_code",
      ip,
      userAgent: agent,
    });

    const remaining = CODE_ATTEMPTS - (failures + 1);

    if (remaining <= 0) {
      return {
        user: null,
        error: { code: "throttled" as const, reason: "attempts" as const },
      };
    }

    return { user: null, error: { code: "bad_code" as const, remaining } };
  }

  await recordAuthEvent({
    email: address,
    outcome: "verify_success",
    userId: data.user.id,
    ip,
    userAgent: agent,
  });

  return { user: data.user, error: null };
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

export async function resendVerificationEmail(email: string) {
  const parsed = forgotPasswordSchema.safeParse({ email });
  if (!parsed.success) {
    return { ok: false, code: "invalid" as const };
  }

  const address = parsed.data.email;
  const ip = await clientIp();
  const agent = await userAgent();

  const [byAddress, byConnection] = await Promise.all([
    codeRequests("verify", address),
    codeRequestsFromIp("verify", ip),
  ]);

  if (
    byAddress >= CODE_REQUEST_LIMIT ||
    byConnection >= CODE_REQUEST_IP_LIMIT
  ) {
    await recordAuthEvent({
      email: address,
      outcome: "verify_throttled",
      ip,
      userAgent: agent,
    });
    return {
      ok: false,
      code: "throttled" as const,
      reason: "requests" as const,
    };
  }

  await recordAuthEvent({
    email: address,
    outcome: "verify_requested",
    ip,
    userAgent: agent,
  });

  const client = await createInsForgeServerClient();
  const { error } = await client.auth.resendVerificationEmail({
    email: address,
    // Built here, never taken from the caller — the page used to pass
    // `window.location.origin`, and this is an HTTP endpoint like any other.
    redirectTo: `${getAppUrl()}/sign-in`,
  });

  if (error) console.error("[auth] resend failed:", error.message);

  return { ok: true, code: null };
}

export async function sendResetPasswordEmail(email: string) {
  const parsed = forgotPasswordSchema.safeParse({ email });
  if (!parsed.success) {
    return { ok: false, code: "invalid" as const };
  }

  const address = parsed.data.email;
  const ip = await clientIp();
  const agent = await userAgent();

  /**
   * The cheapest attack this site offers, and the only one that needs no
   * password at all: point the form at somebody's address and their inbox
   * fills up. Counted per address and per connection, because either alone is
   * trivial to walk around.
   */
  const [byAddress, byConnection] = await Promise.all([
    codeRequests("reset", address),
    codeRequestsFromIp("reset", ip),
  ]);

  if (
    byAddress >= CODE_REQUEST_LIMIT ||
    byConnection >= CODE_REQUEST_IP_LIMIT
  ) {
    await recordAuthEvent({
      email: address,
      outcome: "reset_throttled",
      ip,
      userAgent: agent,
    });
    return {
      ok: false,
      code: "throttled" as const,
      reason: "requests" as const,
    };
  }

  await recordAuthEvent({
    email: address,
    outcome: "reset_requested",
    ip,
    userAgent: agent,
  });

  const client = await createInsForgeServerClient();
  const { error } = await client.auth.sendResetPasswordEmail({
    email: address,
    /**
     * Built here, never taken from the caller.
     *
     * The page used to pass `window.location.origin`, and a Server Action is
     * an HTTP endpoint: anyone could have called this one with an address of
     * their own choosing and had the centre email a link to it.
     */
    redirectTo: `${getAppUrl()}/sign-in`,
  });

  // Logged, and then swallowed. Whether an address has an account behind it is
  // not this form's to tell: it asks for no password, so one request per
  // address would otherwise hand over the whole client list. Everybody is told
  // the code is on its way.
  if (error) console.error("[auth] reset email failed:", error.message);

  return { ok: true, code: null };
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
  const parsed = resetPasswordSchema.safeParse({ email, otp, newPassword });
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "invalid" as const,
        fields: parseErrors(resetPasswordSchema, { email, otp, newPassword }),
      },
    };
  }

  const address = parsed.data.email;
  const ip = await clientIp();
  const agent = await userAgent();

  /**
   * The one that matters most on this page.
   *
   * The code is six digits. Uncounted, a script walks the whole million and
   * ends up choosing somebody's password — a worse outcome than any number of
   * unwanted emails. Running out closes the reset until the window rolls over;
   * it does not lock the account, because this form needs no password and a
   * lock here would be a way to shut any client out at will.
   */
  const failures = await codeFailures("reset", address);

  if (failures >= CODE_ATTEMPTS) {
    await recordAuthEvent({
      email: address,
      outcome: "reset_throttled",
      ip,
      userAgent: agent,
    });
    return {
      ok: false,
      error: { code: "throttled" as const, reason: "attempts" as const },
    };
  }

  // The same rising cost as the sign-in, paid before the code is checked.
  await wait(backoffMs(failures));

  const client = await createInsForgeServerClient();

  const { data, error: exchangeError } =
    await client.auth.exchangeResetPasswordToken({
      email: address,
      code: parsed.data.otp,
    });

  if (exchangeError || !data?.token) {
    await recordAuthEvent({
      email: address,
      outcome: "reset_bad_code",
      ip,
      userAgent: agent,
    });
    const remaining = CODE_ATTEMPTS - (failures + 1);

    // The last wrong code closes the reset rather than reporting "0 tries
    // left" beside a button that still looks willing.
    if (remaining <= 0) {
      return {
        ok: false,
        error: { code: "throttled" as const, reason: "attempts" as const },
      };
    }

    return { ok: false, error: { code: "bad_code" as const, remaining } };
  }

  const { error: resetError } = await client.auth.resetPassword({
    newPassword: parsed.data.newPassword,
    otp: data.token,
  });

  if (resetError) {
    console.error("[auth] reset failed after exchange:", resetError.message);
    return { ok: false, error: { code: "generic" as const } };
  }

  await recordAuthEvent({
    email: address,
    outcome: "reset_success",
    ip,
    userAgent: agent,
  });

  // Somebody who reached the mailbox and set a new password has proved more
  // than the sign-in ever asks. Leaving the lock standing would send them
  // straight back to a door they had just opened.
  await clearLock(address);

  return { ok: true, error: null };
}
