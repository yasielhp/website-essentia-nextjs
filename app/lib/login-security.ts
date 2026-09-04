import { headers } from "next/headers";
import { getAdminClient } from "@/lib/insforge-admin";

/**
 * The counting half of the login.
 *
 * SERVER ONLY, and deliberately **not** a `"use server"` module: every export
 * of one is a public HTTP endpoint, and `clearLock` would then be a way for
 * anybody to open any account they had just shut.
 *
 * The rules live here as constants rather than as numbers buried in the flow,
 * because they are the whole design and somebody will want to argue with them:
 *
 *   five failures in fifteen minutes shut the account for thirty,
 *   twenty failures from one connection in fifteen minutes shut the door,
 *   and the third, fourth and fifth attempts each cost the caller some time.
 */

/** Failures against one address before it is locked. */
export const LOCK_THRESHOLD = 5;
/** How far back either counter looks. */
export const WINDOW_MINUTES = 15;
/** Failures from one IP inside that window before it is refused outright. */
export const IP_CEILING = 20;
/** How long a lock stands if nobody follows the link. */
export const LOCK_MINUTES = 30;

/**
 * What the sign-in tells the browser when it refuses.
 *
 * A code, never the SDK's own sentence: the screen is bilingual, and the
 * wording belongs in `messages/` where it can be translated and changed
 * without touching an action. It also stops Insforge's internal phrasing from
 * reaching a client's screen.
 *
 * Declared here rather than in `app/actions/auth.ts` because a `"use server"`
 * module that exports a type compiles fine and then crashes at runtime.
 */
export type SignInError =
  | { code: "invalid"; fields: { email?: string; password?: string } }
  | { code: "bad_credentials"; remaining: number }
  | { code: "locked" }
  | { code: "ip_rate_limited" }
  | { code: "unverified" }
  | { code: "generic" };

export type LoginOutcome =
  | "success"
  | "bad_password"
  | "unknown_email"
  | "locked"
  | "rate_limited"
  | "unlocked";

/** The two outcomes that mean somebody guessed wrong. */
const GUESSES: LoginOutcome[] = ["bad_password", "unknown_email"];

/**
 * How long the caller waits before the password is even checked.
 *
 * Indexed by failures already on record. The first two attempts are free —
 * people mistype — and the wait then grows fast enough that a script gets
 * fifteen seconds of nothing for its last three guesses.
 */
const BACKOFF_MS = [0, 0, 2000, 5000, 8000];

export function backoffMs(failures: number): number {
  return BACKOFF_MS[Math.min(failures, BACKOFF_MS.length - 1)] ?? 0;
}

export function wait(ms: number): Promise<void> {
  return ms > 0
    ? new Promise((resolve) => setTimeout(resolve, ms))
    : Promise.resolve();
}

function windowStart(): string {
  return new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
}

/**
 * The caller's address, as far as the proxy in front will say.
 *
 * `x-forwarded-for` is a list appended to by every hop; the client sits at the
 * head. It is trivially forged by the client itself, but Vercel rewrites the
 * header rather than extending it, so the first entry is the connection Vercel
 * actually accepted. Null in local development, where there is no proxy and no
 * ceiling worth enforcing.
 */
export async function clientIp(): Promise<string | null> {
  const list = (await headers()).get("x-forwarded-for");
  const first = list?.split(",")[0]?.trim();
  if (!first) return null;

  // The column is `inet`, so a malformed value would take the whole audit row
  // down with it. Anything that is not plainly an address is dropped instead.
  const looksLikeAddress = /^[0-9a-fA-F:.]+$/.test(first) && first.length <= 45;
  return looksLikeAddress ? first : null;
}

export async function userAgent(): Promise<string | null> {
  return (await headers()).get("user-agent")?.slice(0, 400) ?? null;
}

/**
 * Adds one line to the trail.
 *
 * Never throws, for the same reason `recordBookingEvent` does not: a sign-in
 * that fails because its own log could not be written would be the worse
 * outcome. Every caller can await this without a `try`.
 */
export async function recordLoginEvent(input: {
  email: string;
  outcome: LoginOutcome;
  userId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  try {
    const { error } = await getAdminClient()
      .database.from("login_events")
      .insert([
        {
          email: input.email,
          user_id: input.userId ?? null,
          ip: input.ip ?? null,
          user_agent: input.userAgent ?? null,
          outcome: input.outcome,
        },
      ]);

    // The SDK reports a refused write as a value, not an exception, so the
    // catch below never sees one. Silence here would disarm the counter as
    // well as the audit, because the counter reads these very rows.
    if (error) console.error("[login-security] event insert refused:", error);
  } catch (err) {
    console.error("[login-security] could not record event:", err);
  }
}

/**
 * Failures against one address since it last succeeded.
 *
 * A correct password resets the count without erasing anything: the walk stops
 * at the newest `success` rather than deleting what came before it. Refusals
 * (`locked`, `rate_limited`) are not guesses and do not count, or a locked
 * account would drive its own counter upward every time somebody tried the
 * door.
 */
export async function accountFailures(email: string): Promise<number> {
  try {
    const { data, error } = await getAdminClient()
      .database.from("login_events")
      .select("outcome")
      .eq("email", email)
      .gte("created_at", windowStart())
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[login-security] failure count refused:", error);
      return 0;
    }

    let failures = 0;
    for (const row of (data ?? []) as { outcome: LoginOutcome }[]) {
      if (row.outcome === "success") break;
      if (GUESSES.includes(row.outcome)) failures += 1;
    }
    return failures;
  } catch (err) {
    // Fail open: a database that cannot be read must not lock everybody out.
    // The password still has to be right, so this loosens a rate limit rather
    // than the authentication itself.
    console.error("[login-security] could not count failures:", err);
    return 0;
  }
}

/** Whether this connection has already spent its allowance. */
export async function ipOverCeiling(ip: string | null): Promise<boolean> {
  if (!ip) return false;

  try {
    const { data, error } = await getAdminClient()
      .database.from("login_events")
      .select("outcome")
      .eq("ip", ip)
      .gte("created_at", windowStart())
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("[login-security] ip count refused:", error);
      return false;
    }

    const failures = ((data ?? []) as { outcome: LoginOutcome }[]).filter(
      (row) => GUESSES.includes(row.outcome),
    ).length;

    return failures >= IP_CEILING;
  } catch (err) {
    console.error("[login-security] could not count ip failures:", err);
    return false;
  }
}

export type AccountLock = {
  email: string;
  expires_at: string;
  unlock_token: string;
  attempts: number;
};

/**
 * The lock standing against this address right now, if any.
 *
 * An expired one is deleted on the way past rather than left to accumulate:
 * this is the only read that ever visits the row, so it is the only place that
 * can notice the thirty minutes are up.
 */
export async function activeLock(email: string): Promise<AccountLock | null> {
  try {
    const db = getAdminClient().database;
    const { data, error } = await db
      .from("account_locks")
      .select("email, expires_at, unlock_token, attempts, unlocked_at")
      .eq("email", email)
      .maybeSingle();

    if (error || !data) return null;

    const row = data as AccountLock & { unlocked_at: string | null };
    if (row.unlocked_at) return null;

    if (new Date(row.expires_at).getTime() <= Date.now()) {
      await db.from("account_locks").delete().eq("email", email);
      return null;
    }

    return row;
  } catch (err) {
    // Fail open, as above.
    console.error("[login-security] could not read lock:", err);
    return null;
  }
}

/** Opens the account again. Called on a correct password and on the link. */
export async function clearLock(email: string): Promise<void> {
  try {
    await getAdminClient()
      .database.from("account_locks")
      .delete()
      .eq("email", email);
  } catch (err) {
    console.error("[login-security] could not clear lock:", err);
  }
}

/**
 * Shuts the account and mints the token that opens it.
 *
 * The row is replaced rather than updated, so a second lock on the same
 * address always carries a fresh token: reusing the old one would keep a link
 * from an earlier email alive long after it should have died.
 */
export async function createLock(
  email: string,
  attempts: number,
): Promise<AccountLock | null> {
  try {
    const db = getAdminClient().database;
    await db.from("account_locks").delete().eq("email", email);

    const { data, error } = await db
      .from("account_locks")
      .insert([
        {
          email,
          expires_at: new Date(
            Date.now() + LOCK_MINUTES * 60_000,
          ).toISOString(),
          attempts,
        },
      ])
      .select("email, expires_at, unlock_token, attempts")
      .maybeSingle();

    if (error || !data) {
      console.error("[login-security] lock insert refused:", error);
      return null;
    }

    return data as AccountLock;
  } catch (err) {
    console.error("[login-security] could not create lock:", err);
    return null;
  }
}

/**
 * Burns the token from the email and opens the account.
 *
 * Single use: `unlocked_at` is what spends it, and the row is kept afterwards
 * so a second visit to the same link can say "already used" rather than
 * "never existed" — the difference between a stale bookmark and a forgery.
 */
export async function consumeUnlockToken(
  token: string,
): Promise<
  | { status: "unlocked"; email: string }
  | { status: "expired"; email: string }
  | { status: "invalid" }
> {
  try {
    const db = getAdminClient().database;
    const { data, error } = await db
      .from("account_locks")
      .select("email, expires_at, unlocked_at")
      .eq("unlock_token", token)
      .maybeSingle();

    if (error || !data) return { status: "invalid" };

    const row = data as {
      email: string;
      expires_at: string;
      unlocked_at: string | null;
    };

    if (row.unlocked_at) return { status: "invalid" };

    if (new Date(row.expires_at).getTime() <= Date.now()) {
      await db.from("account_locks").delete().eq("email", row.email);
      return { status: "expired", email: row.email };
    }

    const { error: updateError } = await db
      .from("account_locks")
      .update({ unlocked_at: new Date().toISOString() })
      .eq("unlock_token", token);

    if (updateError) {
      console.error("[login-security] unlock refused:", updateError);
      return { status: "invalid" };
    }

    return { status: "unlocked", email: row.email };
  } catch (err) {
    console.error("[login-security] could not consume token:", err);
    return { status: "invalid" };
  }
}

/**
 * Who owns this address, if anybody.
 *
 * Only ever used to tell `bad_password` from `unknown_email` in the trail and
 * to find out where to send the lock notice. The caller sees the same answer
 * either way.
 */
export type Account = {
  id: string;
  email: string;
  name: string;
  locale: "en" | "es";
};

export async function findAccount(email: string): Promise<Account | null> {
  try {
    const { data, error } = await getAdminClient()
      .database.from("profiles")
      .select("id, email, first_name, full_name, preferred_language")
      .eq("email", email)
      .maybeSingle();

    if (error || !data) return null;

    const row = data as {
      id: string;
      email: string | null;
      first_name: string | null;
      full_name: string | null;
      preferred_language: string | null;
    };

    return {
      id: row.id,
      // The lookup was by address, so it is never null in practice; the
      // fallback exists so a half-filled profile cannot send an email to
      // "null".
      email: row.email ?? email,
      // A first name if there is one — the emails address people directly and
      // a full legal name reads like a letter from a bank.
      name: row.first_name ?? row.full_name ?? "",
      locale: row.preferred_language === "es" ? "es" : "en",
    };
  } catch {
    return null;
  }
}

/** How long the trail is kept before it is swept. */
const RETENTION_DAYS = 90;

/**
 * Drops the old end of the trail.
 *
 * `login_events` gains a row per attempt and is never otherwise deleted from,
 * so left alone it grows without bound — and the two counters read it, so a
 * table that grows forever is a login that gets slower forever. Ninety days is
 * long enough to investigate an incident somebody noticed late and short
 * enough that addresses and IPs are not kept for their own sake.
 *
 * Never throws: a sweep that fails is a table that is too big, not a login
 * that is broken.
 */
export async function pruneLoginEvents(): Promise<void> {
  try {
    const cutoff = new Date(
      Date.now() - RETENTION_DAYS * 24 * 3_600_000,
    ).toISOString();

    const { error } = await getAdminClient()
      .database.from("login_events")
      .delete()
      .lt("created_at", cutoff);

    if (error) console.error("[login-security] prune refused:", error);
  } catch (err) {
    console.error("[login-security] could not prune:", err);
  }
}
