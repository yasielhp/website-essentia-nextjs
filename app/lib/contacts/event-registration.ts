import { z } from "zod";
import { getAdminClient } from "@/lib/insforge-admin";
import type { AuthContext } from "@/lib/auth-guard";
import type { Visitor } from "@/lib/bookings/visitor";
import type { RateLimiter } from "@/lib/campaigns/rate-limit";
import {
  allowedFor,
  createContactLimiter,
  isMemberAddress,
  personFields,
} from "./public-contact";
import { writeContact } from "./write-contact";

/**
 * A registration for a run of the Running Club or a session of the education
 * programmes, written by the server.
 *
 * The two registration pages used to call, from the browser and with the
 * public key, `check_email_role` (an address's account and role, to anybody),
 * `upsert_contact` (any contact, with any consent) and `register_for_race` /
 * `register_for_education`, SECURITY DEFINER functions that register ANY
 * account or contact for ANY event, by id, with nothing checked. Their
 * EXECUTE is the service key's alone now (migration
 * `20261124_revoke_public_definer_functions`), and these are the doors:
 *
 *  - a guest (`registerGuestCore`): the event must exist; an address that is
 *    a member's is told so ("member", nothing written) and nothing else about
 *    it; her contact is written the PUBLIC way (`writeContact`: a new one as
 *    the page always wrote it, with no consent at all, since these forms ask
 *    for none; an existing one is never changed), and the registration is
 *    hers, by that contact. Rate limited per caller, like the booking form's
 *    contact (not per email, so a stranger cannot spend somebody's turn);
 *  - an account (`registerAccountCore`): a signed-in person registers HERSELF,
 *    the account her token proves, never an id the browser sends; the team
 *    (admin and staff) may register any account, by its id.
 *
 * A registration that is already there is no error (the functions ignore a
 * repeat). Server only, and deliberately not a `"use server"` module: the
 * thin doors are in `app/actions/event-registration.ts`.
 */

type Db = ReturnType<typeof getAdminClient>["database"];

/** The table of each kind of event. */
const TABLES = { race: "races", education: "education_sessions" } as const;
type EventKind = keyof typeof TABLES;

const eventFields = {
  kind: z.enum(["race", "education"]),
  eventId: z.guid(),
};

export const guestRegistrationSchema = z.strictObject({
  ...eventFields,
  ...personFields,
  phone: z.string().trim().min(1).max(40),
});
export type GuestRegistrationInput = z.input<typeof guestRegistrationSchema>;

export const accountRegistrationSchema = z.strictObject({
  ...eventFields,
  /**
   * Somebody else's account: the team's to choose. Left out, the caller's
   * own, which is what the pages send.
   */
  userId: z.guid().optional(),
});
export type AccountRegistrationInput = z.input<
  typeof accountRegistrationSchema
>;

export type RegistrationResult =
  | { ok: true }
  | {
      ok: false;
      error:
        /** The address is a member's: she is asked to sign in, nothing written. */
        | "member"
        /** Not what the page sends. */
        | "invalid"
        /** No such run or session. */
        | "not_found"
        /** Somebody else's account, and the caller is not of the team. */
        | "forbidden"
        | "rate_limited"
        /** No session, or one that does not check out. */
        | "session"
        | "failed";
    };

/** The roles that may register an account other than their own. */
const TEAM = new Set(["admin", "staff"]);

const sharedLimiter = createContactLimiter(10);

/** Whether the event exists; `"failed"` when the database did not answer. */
async function eventExists(
  db: Db,
  kind: EventKind,
  id: string,
): Promise<boolean | "failed"> {
  const { data, error } = await db
    .from(TABLES[kind])
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (error) return "failed";
  return data !== null;
}

/**
 * The registration itself, with the service key. Each function by its name
 * in the call, so the list of the functions the code calls can be read from
 * the source (`session-types.test.ts`).
 */
async function register(
  db: Db,
  kind: EventKind,
  eventId: string,
  who: { p_user_id: string } | { p_contact_id: string },
): Promise<boolean> {
  const { error } =
    kind === "race"
      ? await db.rpc("register_for_race", { p_race_id: eventId, ...who })
      : await db.rpc("register_for_education", {
          p_session_id: eventId,
          ...who,
        });
  if (error) {
    console.error(`[registration] the ${kind} registration failed:`, error);
    return false;
  }
  return true;
}

/** A guest, from the page's form. */
export async function registerGuestCore(
  raw: unknown,
  deps: { visitor: Visitor; limiter?: RateLimiter },
): Promise<RegistrationResult> {
  const parsed = guestRegistrationSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const input = parsed.data;
  if (!allowedFor(deps.limiter ?? sharedLimiter, deps.visitor)) {
    return { ok: false, error: "rate_limited" };
  }

  try {
    const db = getAdminClient().database;
    const exists = await eventExists(db, input.kind, input.eventId);
    if (exists === "failed") return { ok: false, error: "failed" };
    if (!exists) return { ok: false, error: "not_found" };

    if (await isMemberAddress(db, input.email)) {
      return { ok: false, error: "member" };
    }

    // As the page always wrote a new one: no gender, and no consent of any
    // kind. An existing contact is not changed.
    const contactId = await writeContact(
      db,
      {
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        language: input.language,
        gender: null,
        newsletter: null,
        whatsappMarketing: null,
      },
      "public",
    );
    if (!contactId) return { ok: false, error: "failed" };

    const done = await register(db, input.kind, input.eventId, {
      p_contact_id: contactId,
    });
    return done ? { ok: true } : { ok: false, error: "failed" };
  } catch (err) {
    console.error("[registration] the guest could not be registered:", err);
    return { ok: false, error: "failed" };
  }
}

/** A signed-in person: herself, or, for the team, any account. */
export async function registerAccountCore(
  actor: AuthContext,
  raw: unknown,
): Promise<RegistrationResult> {
  const parsed = accountRegistrationSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const input = parsed.data;
  const userId = input.userId ?? actor.userId;
  if (userId !== actor.userId && !TEAM.has(actor.role)) {
    return { ok: false, error: "forbidden" };
  }

  try {
    const db = getAdminClient().database;
    const exists = await eventExists(db, input.kind, input.eventId);
    if (exists === "failed") return { ok: false, error: "failed" };
    if (!exists) return { ok: false, error: "not_found" };

    const done = await register(db, input.kind, input.eventId, {
      p_user_id: userId,
    });
    return done ? { ok: true } : { ok: false, error: "failed" };
  } catch (err) {
    console.error("[registration] the account could not be registered:", err);
    return { ok: false, error: "failed" };
  }
}
