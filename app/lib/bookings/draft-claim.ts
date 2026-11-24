import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";

/**
 * Which bookings of the public form THIS browser started.
 *
 * A booking id travels in the page, in the bank's return addresses and in
 * the browser's storage, so knowing one proves nothing. When the server
 * writes a draft (or a booking afresh) for the public form it hands the
 * browser a claim on it: the id signed with a server secret, kept in an
 * httpOnly cookie (scripts cannot read or forge it). Rewriting the draft, its
 * hour, confirming it and opening its payment all ask for that claim: a draft
 * cannot be changed, confirmed or charged from another browser.
 *
 * The cookie keeps the last few claims, newest first, for a day: enough for a
 * visitor who books twice, or returns from the bank, and nothing a stranger
 * could reuse.
 */

export const CLAIM_COOKIE = "essentia_booking_claims";
/** How many claims one browser keeps. */
export const MAX_CLAIMS = 5;
/** How long a claim lives: a draft is released long before. */
export const CLAIM_MAX_AGE_S = 24 * 60 * 60;

function secret(): string {
  // `||`, not `??`: a variable left empty in a copied .env is no secret.
  return (
    process.env.BOOKING_CLAIM_SECRET ||
    process.env.OAUTH_STATE_SECRET ||
    serverEnv.insforgeServiceKey
  );
}

function signatureOf(bookingId: string): string {
  return createHmac("sha256", secret())
    .update(`booking-claim|${bookingId.toLowerCase()}`)
    .digest("base64url");
}

/** The claim on one booking, as the cookie keeps it. */
export function claimFor(bookingId: string): string {
  return `${bookingId.toLowerCase()}.${signatureOf(bookingId)}`;
}

/** The booking ids whose claims in this cookie value check out. */
export function claimedIds(cookieValue: string | null | undefined): string[] {
  if (!cookieValue) return [];
  const ids: string[] = [];
  for (const entry of cookieValue.split(",").slice(0, MAX_CLAIMS)) {
    const dot = entry.lastIndexOf(".");
    if (dot <= 0) continue;
    const id = entry.slice(0, dot);
    const given = Buffer.from(entry.slice(dot + 1));
    const expected = Buffer.from(signatureOf(id));
    if (given.length === expected.length && timingSafeEqual(given, expected)) {
      ids.push(id);
    }
  }
  return ids;
}

/** Whether this cookie value holds a valid claim on `bookingId`. */
export function holdsClaim(
  cookieValue: string | null | undefined,
  bookingId: string | null | undefined,
): boolean {
  if (!bookingId) return false;
  return claimedIds(cookieValue).includes(bookingId.toLowerCase());
}

/** The cookie value with a claim on `bookingId` added first. */
export function withClaim(
  cookieValue: string | null | undefined,
  bookingId: string,
): string {
  const kept = claimedIds(cookieValue).filter(
    (id) => id !== bookingId.toLowerCase(),
  );
  return [bookingId, ...kept]
    .slice(0, MAX_CLAIMS)
    .map((id) => claimFor(id))
    .join(",");
}

/** How the cookie is set: httpOnly, this site only, for a day. */
export const CLAIM_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: CLAIM_MAX_AGE_S,
};
