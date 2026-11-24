import { z } from "zod";
import { getAdminClient } from "@/lib/insforge-admin";
import {
  createRateLimiter,
  type RateLimiter,
} from "@/lib/campaigns/rate-limit";
import { isValidPhone, normalizeEmail } from "@/utils/contact";
import type { Visitor } from "@/lib/bookings/visitor";

/**
 * The contact a public form writes, on the server.
 *
 * The public booking form, and the run and course registrations, used to call
 * two SECURITY DEFINER functions from the browser with the public key:
 * `check_email_role`, which told anybody whether an address had an account
 * and which role (`admin` and `staff` included), and `upsert_contact`, which
 * wrote any contact, rewrote the name and phone of an existing one, and
 * stamped the newsletter, WhatsApp-marketing and even the booking-notice
 * consent (`p_whatsapp`) of any address, with no limit. Anybody holding the
 * public key, which every visitor's browser has, could do the same by hand.
 * Their EXECUTE is taken from the browser roles by
 * `insforge/migrations/20261124_revoke_public_definer_functions.sql`.
 *
 * Here the form sends what it always sent and nothing else (a strict object:
 * a key it does not send refuses the call), and the server calls the same
 * two functions with the service key:
 *
 *  - the member check answers ONE thing, whether the address is a member's
 *    (the form then asks her to sign in). Never the role itself: an address
 *    of the team reads the same as one with no account;
 *  - the contact is written by `upsert_contact` exactly as the browser wrote
 *    it, so every consent rule of `upsert_contact` (unticked is `null`, a tick
 *    after a STOP, CLAUDE.md "WhatsApp consent rule") holds as before. "News
 *    and offers" is ONE choice: ticked, the newsletter and WhatsApp marketing
 *    go on together; unticked, `null` touches nothing. The booking-notice
 *    consent is NOT here: it is `saveBookingConsents`' to stamp, with its own
 *    guards, after this has written the contact.
 *
 * Both are rate limited per address of the caller and per email
 * (`createRateLimiter`: a brake in the memory of the instance, not a
 * guarantee).
 *
 * Server only, and deliberately not a `"use server"` module: the thin door is
 * `app/actions/public-contact.ts`.
 */

type Db = ReturnType<typeof getAdminClient>["database"];

/** The fields of a person, as the public forms have them. */
export const personFields = {
  email: z.email().max(254),
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  language: z.enum(["en", "es"]),
};

export const publicContactSchema = z.strictObject({
  ...personFields,
  phone: z.string().trim().min(6).max(40).refine(isValidPhone),
  gender: z.enum(["female", "male", "other"]).nullable(),
  /** "News and offers": `true` when ticked, `null` ("do not touch") when not. */
  marketing: z.literal(true).nullable(),
  /**
   * Ask first whether the address is a member's. The form asks only for a
   * guest who has not already chosen to go on as one.
   */
  checkMember: z.boolean(),
});
export type PublicContactInput = z.input<typeof publicContactSchema>;

export type PublicContactResult =
  /** The address is a member's: nothing was written; she is asked to sign in. */
  | { kind: "member" }
  | { kind: "saved"; contactId: string }
  /** Not what the form sends. */
  | { kind: "invalid" }
  | { kind: "rate_limited" }
  /** The database did not answer, or answered no id. */
  | { kind: "failed" };

/** How often, in ten minutes, per address of the caller and per email. */
export const PUBLIC_CONTACT_LIMITS = { perIp: 20, perEmail: 10 } as const;
const TEN_MINUTES = 10 * 60_000;

export type ContactLimiters = { ip: RateLimiter; email: RateLimiter };

export function createContactLimiters(
  limits: { perIp: number; perEmail: number } = PUBLIC_CONTACT_LIMITS,
): ContactLimiters {
  return {
    ip: createRateLimiter({ max: limits.perIp, windowMs: TEN_MINUTES }),
    email: createRateLimiter({ max: limits.perEmail, windowMs: TEN_MINUTES }),
  };
}

const sharedLimiters = createContactLimiters();

export type PublicContactDeps = {
  visitor: Visitor;
  /** Fresh ones in tests; the instance's own otherwise. */
  limiters?: ContactLimiters;
};

/**
 * Spends one call for this caller and this email. No caller address (no
 * proxy in front, a test) means no limit by address; the email is always
 * counted.
 */
export function allowedFor(
  limiters: ContactLimiters,
  visitor: Visitor,
  email: string,
): boolean {
  if (visitor.ip && !limiters.ip.take(visitor.ip)) return false;
  return limiters.email.take(normalizeEmail(email) ?? email);
}

/**
 * Whether the address belongs to a member's account. Read with the service
 * key; reduced to yes or no here, so the role itself never leaves the
 * server. A database that does not answer is "no": the form goes on as for a
 * guest, as it always did when the check failed.
 */
export async function isMemberAddress(db: Db, email: string): Promise<boolean> {
  try {
    const { data, error } = await db.rpc("check_email_role", {
      p_email: email,
    });
    if (error) return false;
    return data === "member";
  } catch {
    return false;
  }
}

/** What `upsert_contact` is given; `null` consents touch nothing. */
export type ContactWrite = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  language: string;
  gender: string | null;
  newsletter: true | null;
  whatsappMarketing: true | null;
};

/** Writes the contact with the service key and answers its id, or null. */
export async function upsertContact(
  db: Db,
  contact: ContactWrite,
): Promise<string | null> {
  try {
    const { data, error } = await db.rpc("upsert_contact", {
      p_email: contact.email,
      p_first_name: contact.firstName,
      p_last_name: contact.lastName,
      p_phone: contact.phone,
      p_language: contact.language,
      p_gender: contact.gender,
      p_newsletter: contact.newsletter,
      // The booking-notice consent is never a public form's to send here.
      p_whatsapp: null,
      p_whatsapp_marketing: contact.whatsappMarketing,
    });
    if (error || typeof data !== "string" || !data) return null;
    return data;
  } catch {
    return null;
  }
}

/** The details step of the public booking form: who the booking is for. */
export async function savePublicContactCore(
  raw: unknown,
  deps: PublicContactDeps,
): Promise<PublicContactResult> {
  const parsed = publicContactSchema.safeParse(raw);
  if (!parsed.success) return { kind: "invalid" };
  const input = parsed.data;
  if (!allowedFor(deps.limiters ?? sharedLimiters, deps.visitor, input.email)) {
    return { kind: "rate_limited" };
  }

  const db = getAdminClient().database;
  if (input.checkMember && (await isMemberAddress(db, input.email))) {
    return { kind: "member" };
  }

  const contactId = await upsertContact(db, {
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    language: input.language,
    gender: input.gender,
    // One box, both channels (`marketingChoice` in the form).
    newsletter: input.marketing,
    whatsappMarketing: input.marketing,
  });
  if (!contactId) return { kind: "failed" };
  return { kind: "saved", contactId };
}
