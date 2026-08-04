import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";

/**
 * Signed, expiring OAuth `state` values.
 *
 * The Google Calendar callback stores whatever tokens it receives against the
 * service id carried in `state`. Because `client_id` and `redirect_uri` are
 * public, anyone could build their own consent URL and hand the callback a
 * valid code with a `state` of their choosing, silently rebinding a service's
 * calendar to their own Google account. Signing the state makes the callback
 * accept only values this server issued.
 */

const TTL_MS = 15 * 60 * 1000;

function secret(): string {
  return process.env.OAUTH_STATE_SECRET ?? serverEnv.insforgeServiceKey;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Wraps a raw state value with an expiry and a signature. */
export function signState(value: string): string {
  const payload = `${value}|${Date.now() + TTL_MS}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

/**
 * Verifies a signed state and returns the original value,
 * or `null` when the signature is invalid, malformed or expired.
 */
export function verifyState(token: string | null | undefined): string | null {
  if (!token) return null;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const encoded = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  let payload: string;
  try {
    payload = Buffer.from(encoded, "base64url").toString();
  } catch {
    return null;
  }

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const boundary = payload.lastIndexOf("|");
  if (boundary <= 0) return null;

  const expiresAt = Number(payload.slice(boundary + 1));
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;

  return payload.slice(0, boundary);
}
