import { z } from "zod";
import { getAdminClient } from "@/lib/insforge-admin";
import {
  createRateLimiter,
  type RateLimiter,
} from "@/lib/campaigns/rate-limit";
import { isValidPhone } from "@/utils/contact";
import type { Visitor } from "@/lib/bookings/visitor";
import { writeContact } from "./write-contact";

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
 * a key it does not send refuses the call), and the server:
 *
 *  - answers ONE thing about the address, whether it is a member's (the form
 *    then asks her to sign in), read with `check_email_role` and the service
 *    key. Never the role itself: an address of the team reads the same as one
 *    with no account;
 *  - writes the contact the PUBLIC way (`writeContact`, `write-contact.ts`):
 *    a new contact with what she typed, as always; an existing one keeps its
 *    name, phone and language and only gains the "news and offers" yes she
 *    gives, never over a STOP or an unsubscribe. "News and offers" is ONE
 *    choice: ticked, the newsletter and WhatsApp marketing go on together;
 *    unticked, `null` touches nothing. The booking-notice consent is NOT here:
 *    it is `saveBookingConsents`' to stamp, with its own guards (the same
 *    phone among them), after this.
 *
 * Rate limited per address of the CALLER (`createRateLimiter`: a brake in the
 * memory of the instance, not a guarantee), which is what slows down somebody
 * walking through many addresses. Deliberately not per email: a stranger
 * could spend an address's allowance and so keep its owner's booking from
 * being linked to her contact, and with the public way there is nothing to
 * gain by writing one address again and again. A refusal never stops the
 * booking: the form goes on without the link, as when the database fails.
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

/** How often, in ten minutes, per address of the caller. */
export const PUBLIC_CONTACT_LIMIT_PER_IP = 20;
const TEN_MINUTES = 10 * 60_000;

export function createContactLimiter(
  perIp: number = PUBLIC_CONTACT_LIMIT_PER_IP,
): RateLimiter {
  return createRateLimiter({ max: perIp, windowMs: TEN_MINUTES });
}

const sharedLimiter = createContactLimiter();

export type PublicContactDeps = {
  visitor: Visitor;
  /** A fresh one in tests; the instance's own otherwise. */
  limiter?: RateLimiter;
};

/**
 * Spends one call for this caller. No caller address (no proxy in front, a
 * test) means no limit.
 */
export function allowedFor(limiter: RateLimiter, visitor: Visitor): boolean {
  return !visitor.ip || limiter.take(visitor.ip);
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

/** The details step of the public booking form: who the booking is for. */
export async function savePublicContactCore(
  raw: unknown,
  deps: PublicContactDeps,
): Promise<PublicContactResult> {
  const parsed = publicContactSchema.safeParse(raw);
  if (!parsed.success) return { kind: "invalid" };
  const input = parsed.data;
  if (!allowedFor(deps.limiter ?? sharedLimiter, deps.visitor)) {
    return { kind: "rate_limited" };
  }

  const db = getAdminClient().database;
  if (input.checkMember && (await isMemberAddress(db, input.email))) {
    return { kind: "member" };
  }

  const contactId = await writeContact(
    db,
    {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      language: input.language,
      gender: input.gender,
      // One box, both channels (`marketingChoice` in the form).
      newsletter: input.marketing,
      whatsappMarketing: input.marketing,
    },
    "public",
  );
  if (!contactId) return { kind: "failed" };
  return { kind: "saved", contactId };
}
