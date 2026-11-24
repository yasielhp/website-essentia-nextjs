import { z } from "zod";
import { getAdminClient } from "@/lib/insforge-admin";
import { authenticate } from "@/lib/auth-guard";
import { recordBookingEvent } from "@/lib/booking-events/record";
import { bookableServices } from "@/data/services-data";
import { fetchAvailability } from "@/actions/availability";
import { isValidPhone } from "@/utils/contact";
import { parseIsoDate } from "@/utils/format";
import {
  createRateLimiter,
  type RateLimiter,
} from "@/lib/campaigns/rate-limit";
import { isSlotTaken } from "./slot-taken";
import { holdsClaim } from "./draft-claim";
import { sessionStartsAt } from "./cancellation-window";
import type { Visitor } from "./visitor";

/**
 * The writes of the public booking form, on the server.
 *
 * The form used to write `bookings` from the browser: a draft through
 * `create_draft_booking` (a SECURITY DEFINER function any visitor could call
 * with any contact, account or service), its day and hour through
 * `update_booking_datetime`, and, when it had no draft, the booking itself
 * through the open INSERT policy `anyone_insert_bookings`, with whatever
 * status, price or payment it chose. Anybody holding the public key, which
 * every visitor's browser has, could do the same by hand.
 *
 * Here the visitor sends only what she chooses: the service, the session
 * type, the professional, the day and the hour, her details and her notes.
 * Everything else is the server's: the status (`draft`, then `pending`), the
 * price (read from the session type), how it is paid (online, in full), the
 * place (the centre), the account it belongs to (her VERIFIED session, never
 * an id sent by the browser) and who created it. The input is a strict
 * object: a key the form does not send refuses the whole call.
 *
 * A booking the server writes for the form is CLAIMED by the browser that
 * asked (`draft-claim.ts`: a signed, httpOnly cookie). Rewriting the draft,
 * setting its hour and confirming it ask for that claim, and so does opening
 * its payment (`api/checkout/booking-session`): a known id is not enough.
 *
 * Three steps, the same three as before:
 *
 *   1. `savePublicDraftCore`, from the details step: starts the draft, or
 *      rewrites the one this browser already started (a corrected typo, a
 *      step back and forward) so one visit is one row.
 *   2. `setPublicDraftTimeCore`, from the calendar: the day and the hour.
 *   3. `confirmPublicBookingCore`, from the last step: the draft becomes a
 *      booking (`pending`, waiting for its payment), or a booking is written
 *      afresh when there is no draft any more.
 *
 * The third also turns the contact of the booking into a client when it was a
 * lead (`promoteToClient`), which the browser used to do with the public key.
 *
 * The third checks the hour on the server: not past (Canary time), offered by
 * the professional's own schedule and free (`fetchAvailability`), and a
 * professional is always assigned (the one she chose, or the first free one
 * when she left it to the centre), so the database's guard covers every
 * public booking. The database has the last word: a booking that holds a slot
 * cannot overlap another of the same professional (`bookings_no_overlap`), so
 * of two visitors confirming one hour the second is answered `slot_taken` and
 * no payment is opened for her.
 *
 * Every step is rate limited per address (`createRateLimiter`: a brake in the
 * memory of the instance, not a guarantee), and one address may keep only a
 * few bookings waiting for their payment at once.
 *
 * Server only, and deliberately not a `"use server"` module: the thin doors
 * are in `app/actions/public-booking.ts`.
 */

/** A day of the calendar, `YYYY-MM-DD`: 2099-02-31 is not one. */
const isoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => parseIsoDate(value)?.toISOString().slice(0, 10) === value);
const hourMinute = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** Who she is and what she picked, as the details step has it. */
const draftFields = {
  /** The draft this visit started, if any. */
  draftId: z.guid().nullable(),
  /**
   * The contact the form found or wrote for this address (`upsert_contact`).
   * Linked only when that contact IS this address (`ownContact`).
   */
  contactId: z.guid().nullable(),
  serviceId: z.string().trim().min(1).max(64),
  tierId: z.guid().nullable(),
  staffId: z.guid().nullable(),
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  email: z.email().max(254),
  phone: z.string().trim().min(6).max(40).refine(isValidPhone),
  notes: z.string().trim().max(4000).nullable(),
};

export const publicDraftSchema = z.strictObject(draftFields);
export type PublicDraftInput = z.input<typeof publicDraftSchema>;

export const publicDraftTimeSchema = z.strictObject({
  draftId: z.guid(),
  date: isoDay,
  time: hourMinute,
});
export type PublicDraftTimeInput = z.input<typeof publicDraftTimeSchema>;

/** The last step: everything above, with the session type, day and hour required. */
export const publicConfirmSchema = z.strictObject({
  ...draftFields,
  tierId: z.guid(),
  date: isoDay,
  time: hourMinute,
});
export type PublicConfirmInput = z.input<typeof publicConfirmSchema>;

/** The caller's verified account, or null for a guest. */
export type PublicSession = { userId: string } | null;

/** Too many calls from one address, or too many bookings waiting to be paid. */
type Refused = "rate_limited" | "too_many_pending";

export type SaveDraftResult =
  | { ok: true; bookingId: string }
  | { ok: false; error: "invalid" | "failed" | "rate_limited" };

export type SetDraftTimeResult =
  | { ok: true }
  | {
      ok: false;
      error: "invalid" | "failed" | "not_yours" | "rate_limited";
    };

export type ConfirmPublicResult =
  /** Her draft is a booking now, made by this call. */
  | { kind: "promoted"; bookingId: string }
  /** She had no draft (or it was gone): a booking was written afresh. */
  | { kind: "created"; bookingId: string }
  /** The draft is past being a draft: confirmed elsewhere (another tab). */
  | { kind: "not_draft" }
  /** The professional's hour is not free (taken, or not offered any more). */
  | { kind: "slot_taken" }
  /** The database did not answer: nothing is known. */
  | { kind: "failed" }
  /** Not what the form sends, or a choice the centre does not offer. */
  | { kind: "invalid" }
  | { kind: Refused };

/** How often one address may call each step, in ten minutes. */
export const PUBLIC_LIMITS = { draft: 10, time: 60, confirm: 10 } as const;
const TEN_MINUTES = 10 * 60_000;
/** How many bookings one address may keep waiting for their payment. */
export const MAX_PENDING_PER_EMAIL = 3;

export type PublicLimiters = {
  draft: RateLimiter;
  time: RateLimiter;
  confirm: RateLimiter;
};

export function createPublicLimiters(): PublicLimiters {
  return {
    draft: createRateLimiter({
      max: PUBLIC_LIMITS.draft,
      windowMs: TEN_MINUTES,
    }),
    time: createRateLimiter({ max: PUBLIC_LIMITS.time, windowMs: TEN_MINUTES }),
    confirm: createRateLimiter({
      max: PUBLIC_LIMITS.confirm,
      windowMs: TEN_MINUTES,
    }),
  };
}

const sharedLimiters = createPublicLimiters();

/** What a step needs to know of the caller beyond her input. */
export type PublicDeps = {
  visitor: Visitor;
  /** Fresh ones in tests; the instance's own otherwise. */
  limiters?: PublicLimiters;
  /** The clock, for "not in the past". */
  now?: () => number;
};

/** Spends one call of `step` for this address; no address (no proxy), no limit. */
function allowed(deps: PublicDeps, step: keyof PublicLimiters): boolean {
  const ip = deps.visitor.ip;
  if (!ip) return true;
  return (deps.limiters ?? sharedLimiters)[step].take(ip);
}

type Db = ReturnType<typeof getAdminClient>["database"];

type TierRow = {
  id: string;
  service_id: string | null;
  duration_minutes: number | null;
  price_eur: number | string | null;
  price_center_eur: number | string | null;
  active: boolean | null;
};

/**
 * Whose session this is, from the token the browser holds.
 *
 * A token that does not check out (expired, forged, an account with no
 * profile) is a guest: the booking is still written, linked to no account,
 * because a booking is not worth losing over a session and an account id the
 * server cannot verify is never written.
 */
export async function publicSession(
  accessToken: string | null | undefined,
): Promise<PublicSession> {
  if (!accessToken) return null;
  try {
    const { userId } = await authenticate(accessToken);
    return { userId };
  } catch {
    return null;
  }
}

/**
 * The session type, checked against the service, and the professional,
 * checked against the session type. Only what the form could have offered:
 * a service the site books and the centre has switched on, a session type of
 * that service that is on sale, a professional assigned to it. `null` when
 * any is not; `"failed"` when the database did not answer.
 */
async function readChoice(
  db: Db,
  input: { serviceId: string; tierId: string | null; staffId: string | null },
): Promise<{ tier: TierRow | null; staffIds: string[] } | null | "failed"> {
  if (!bookableServices.some((s) => s.id === input.serviceId)) return null;
  if (!input.tierId) return input.staffId ? null : { tier: null, staffIds: [] };

  const [service, tierRead, staffRead] = await Promise.all([
    db
      .from("service_settings")
      .select("id, active")
      .eq("id", input.serviceId)
      .maybeSingle(),
    db
      .from("service_tiers")
      .select(
        "id, service_id, duration_minutes, price_eur, price_center_eur, active",
      )
      .eq("id", input.tierId)
      .maybeSingle(),
    db.from("staff_tiers").select("staff_id").eq("tier_id", input.tierId),
  ]);
  if (service.error || tierRead.error || staffRead.error) return "failed";
  if ((service.data as { active: boolean | null } | null)?.active !== true) {
    return null;
  }
  const tier = tierRead.data as TierRow | null;
  // A session type of another service would price this one by its rate, and
  // one switched off is not on sale.
  if (!tier || tier.service_id !== input.serviceId || tier.active !== true) {
    return null;
  }
  // Only the people assigned to the session type are offered.
  const staffIds = ((staffRead.data ?? []) as { staff_id: string }[]).map(
    (r) => r.staff_id,
  );
  if (input.staffId && !staffIds.includes(input.staffId)) return null;
  return { tier, staffIds };
}

/**
 * The contact to link: the one the form named, only when it is this
 * address's. A contact id is not a secret the visitor proves she holds, so
 * one that belongs to somebody else links nothing (the booking is written
 * without one, as when `upsert_contact` failed).
 */
async function ownContact(
  db: Db,
  contactId: string | null,
  email: string,
): Promise<string | null> {
  if (!contactId) return null;
  const { data, error } = await db
    .from("contacts")
    .select("id, email")
    .eq("id", contactId)
    .maybeSingle();
  const row = data as { id: string; email: string | null } | null;
  if (error || !row) return null;
  const same =
    (row.email ?? "").trim().toLowerCase() === email.trim().toLowerCase();
  if (!same) {
    console.error("[booking] a contact of another address was not linked");
    return null;
  }
  return row.id;
}

/**
 * A lead who books becomes a client: the contact this booking is linked to
 * by its own address (`ownContact`), once THIS call has made the booking.
 *
 * Through `promote_contact_to_client` with the service key. The browser used
 * to call it with the public key, which let anybody turn any contact into a
 * client by its id; its EXECUTE is the service key's alone now (migration
 * `20261124_revoke_public_definer_functions`). The function only ever
 * promotes a lead: a member stays a member. A failure costs nothing but the
 * status, so it is said in the log and the booking stands.
 */
async function promoteToClient(
  db: Db,
  contactId: string | null,
): Promise<void> {
  if (!contactId) return;
  try {
    const { error } = await db.rpc("promote_contact_to_client", {
      p_contact_id: contactId,
    });
    if (error) {
      console.error(
        "[booking] promote_contact_to_client failed; the contact stays a lead:",
        error,
      );
    }
  } catch (err) {
    console.error(
      "[booking] promote_contact_to_client failed; the contact stays a lead:",
      err,
    );
  }
}

const priceOf = (tier: TierRow | null): number | null => {
  if (!tier) return null;
  // The web price; the checkout lowers it when the settings give a discount
  // for paying online.
  const value = tier.price_eur ?? tier.price_center_eur;
  return value === null || value === undefined ? null : Number(value);
};

const durationOf = (tier: TierRow | null): string =>
  tier?.duration_minutes != null ? `${tier.duration_minutes} min` : "";

const titleOf = (serviceId: string): string =>
  bookableServices.find((s) => s.id === serviceId)?.title ?? serviceId;

/** Staff need to know at a glance whether the money is still to be collected. */
const PAYMENT_NOTE = "Pago: 100% online al reservar";
const notesOf = (notes: string | null): string =>
  [PAYMENT_NOTE, notes?.trim() || null].filter(Boolean).join("\n\n");

/** The columns every write of the form sets, from her choice and the server's rules. */
function bookingColumns(
  input: z.output<typeof publicDraftSchema>,
  tier: TierRow | null,
  session: PublicSession,
  contactId: string | null,
): Record<string, unknown> {
  const serviceId = tier?.service_id ?? input.serviceId;
  return {
    service_id: serviceId,
    service_title: titleOf(serviceId),
    tier_id: tier?.id ?? null,
    duration: durationOf(tier),
    price_eur: priceOf(tier),
    // Online there is one way to pay: the whole price, at booking.
    payment_mode: "full",
    location: "centro",
    notes: notesOf(input.notes),
    first_name: input.firstName,
    last_name: input.lastName,
    email: input.email,
    phone: input.phone,
    // Only set when there is one, so a failed `upsert_contact` or a missing
    // professional does not detach a draft that already had them.
    ...(contactId ? { contact_id: contactId } : {}),
    ...(input.staffId ? { staff_id: input.staffId } : {}),
    ...(session
      ? {
          user_id: session.userId,
          created_by_user_id: session.userId,
          created_by_role: "client",
        }
      : { created_by_role: "anonymous" }),
  };
}

async function insertBooking(
  db: Db,
  columns: Record<string, unknown>,
  status: "draft" | "pending",
): Promise<{ id: string } | { error: unknown }> {
  const { data, error } = await db
    .from("bookings")
    .insert([{ ...columns, status }])
    .select("id")
    .single();
  const id = (data as { id?: string } | null)?.id;
  if (error || !id) return { error: error ?? new Error("no id returned") };
  return { id };
}

/** `%`, `_` and `\` are wildcards to ILIKE: an address is matched as written. */
const likeLiteral = (value: string) =>
  value.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * How many bookings this address keeps waiting for their payment (pending,
 * nothing paid), other than `except`. The expiry cron releases them after a
 * while; until then each holds a professional's hour.
 */
async function pendingHolds(
  db: Db,
  email: string,
  except: string | null,
): Promise<number | "failed"> {
  const { data, error } = await db
    .from("bookings")
    .select("id")
    .ilike("email", likeLiteral(email.trim()))
    .eq("status", "pending")
    .in("payment_status", ["pending", "failed"]);
  if (error) return "failed";
  return ((data ?? []) as { id: string }[]).filter((r) => r.id !== except)
    .length;
}

/**
 * The professional who will see her: the one she chose, if that hour is
 * offered and free for her; otherwise, when she left it to the centre, the
 * first assigned person for whom it is. Null when nobody has it.
 */
async function professionalFor(
  input: { tierId: string; staffId: string | null; date: string; time: string },
  tier: TierRow,
  staffIds: string[],
  draftId: string | null,
): Promise<string | null> {
  const candidates = input.staffId ? [input.staffId] : staffIds;
  for (const staffId of candidates) {
    const free = await fetchAvailability({
      tierId: input.tierId,
      staffId,
      from: input.date,
      to: input.date,
      durationMinutes: tier.duration_minutes ?? 60,
      excludeDraftId: draftId,
    });
    if ((free[input.date] ?? []).includes(input.time)) return staffId;
  }
  return null;
}

/**
 * Step 1: who the booking is for, and what she chose.
 *
 * A draft holds no slot in the database (`bookings_no_overlap` leaves drafts
 * out), so this never meets the professional's hour. A draft id this browser
 * holds no claim on is not rewritten: a new draft is started instead.
 */
export async function savePublicDraftCore(
  session: PublicSession,
  raw: unknown,
  deps: PublicDeps,
): Promise<SaveDraftResult> {
  const parsed = publicDraftSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  if (!allowed(deps, "draft")) return { ok: false, error: "rate_limited" };
  const input = parsed.data;

  try {
    const db = getAdminClient().database;
    const choice = await readChoice(db, input);
    if (choice === "failed") return { ok: false, error: "failed" };
    if (!choice) return { ok: false, error: "invalid" };

    const contactId = await ownContact(db, input.contactId, input.email);
    const columns = bookingColumns(input, choice.tier, session, contactId);

    if (input.draftId && holdsClaim(deps.visitor.claims, input.draftId)) {
      const { data, error } = await db
        .from("bookings")
        .update(columns)
        .eq("id", input.draftId)
        .eq("status", "draft")
        .select("id");
      if (error) return { ok: false, error: "failed" };
      if (((data ?? []) as unknown[]).length > 0) {
        return { ok: true, bookingId: input.draftId };
      }
      // Not a draft (confirmed in another tab: the last step says so), or not
      // there at all (cleared by the team): only then is a new one started.
      const { data: found, error: readError } = await db
        .from("bookings")
        .select("id")
        .eq("id", input.draftId)
        .maybeSingle();
      if (readError) return { ok: false, error: "failed" };
      if (found) return { ok: true, bookingId: input.draftId };
    }

    const written = await insertBooking(db, columns, "draft");
    if ("error" in written) {
      console.error("[booking] the draft could not be written:", written.error);
      return { ok: false, error: "failed" };
    }
    return { ok: true, bookingId: written.id };
  } catch (err) {
    console.error("[booking] the draft could not be written:", err);
    return { ok: false, error: "failed" };
  }
}

/** Step 2: the day and the hour, on a draft this browser started. */
export async function setPublicDraftTimeCore(
  raw: unknown,
  deps: PublicDeps,
): Promise<SetDraftTimeResult> {
  const parsed = publicDraftTimeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { draftId, date, time } = parsed.data;
  if (!holdsClaim(deps.visitor.claims, draftId)) {
    return { ok: false, error: "not_yours" };
  }
  if (!allowed(deps, "time")) return { ok: false, error: "rate_limited" };
  try {
    const { error } = await getAdminClient()
      .database.from("bookings")
      .update({ date, time })
      .eq("id", draftId)
      .eq("status", "draft");
    return error ? { ok: false, error: "failed" } : { ok: true };
  } catch {
    return { ok: false, error: "failed" };
  }
}

/** `jueves 20 ago, 14:00`, as the history of a booking says a moment. */
function humanMoment(date: string, time: string): string {
  const parsed = parseIsoDate(date);
  if (!parsed) return time;
  const day = parsed
    .toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    })
    .replace(",", "");
  return `${day}, ${time}`;
}

/**
 * Step 3: the booking itself, waiting for its payment.
 *
 * Her draft is promoted (`draft → pending`) only while it is still a draft and
 * only by the browser that started it, so a replay or a second tab confirms
 * nothing twice and only the call that promoted it writes the history. With no
 * draft (never written, gone, or not this browser's) the booking is written
 * afresh. Either write is where the database refuses an hour another booking
 * of that professional already holds.
 */
export async function confirmPublicBookingCore(
  session: PublicSession,
  raw: unknown,
  deps: PublicDeps,
): Promise<ConfirmPublicResult> {
  const parsed = publicConfirmSchema.safeParse(raw);
  if (!parsed.success) return { kind: "invalid" };
  if (!allowed(deps, "confirm")) return { kind: "rate_limited" };
  const input = parsed.data;
  const now = deps.now?.() ?? Date.now();

  // Not in the past, on the Canary clock.
  const startsAt = sessionStartsAt(input.date, input.time);
  if (!startsAt || startsAt.getTime() <= now) return { kind: "invalid" };

  const draftId =
    input.draftId && holdsClaim(deps.visitor.claims, input.draftId)
      ? input.draftId
      : null;

  try {
    const db = getAdminClient().database;
    const choice = await readChoice(db, input);
    if (choice === "failed") return { kind: "failed" };
    if (!choice || !choice.tier) return { kind: "invalid" };
    const { tier, staffIds } = choice;

    type DraftRow = { status: string | null; service_title: string | null };
    let row: DraftRow | null = null;
    if (draftId) {
      const { data: before, error: readError } = await db
        .from("bookings")
        .select("status, service_title")
        .eq("id", draftId)
        .maybeSingle();
      if (readError) return { kind: "failed" };
      row = before as DraftRow | null;
      if (row && row.status !== "draft") return { kind: "not_draft" };
    }

    // One address keeps only a few bookings waiting for their payment.
    const holds = await pendingHolds(db, input.email, draftId);
    if (holds === "failed") return { kind: "failed" };
    if (holds >= MAX_PENDING_PER_EMAIL) return { kind: "too_many_pending" };

    // The hour, on the professional's own schedule, and somebody to see her.
    const staffId = await professionalFor(
      {
        tierId: tier.id,
        staffId: input.staffId,
        date: input.date,
        time: input.time,
      },
      tier,
      staffIds,
      draftId,
    );
    if (!staffId) return { kind: "slot_taken" };

    const serviceId = tier.service_id ?? input.serviceId;
    const slot = {
      tier_id: tier.id,
      service_id: serviceId,
      service_title: titleOf(serviceId),
      duration: durationOf(tier),
      price_eur: priceOf(tier),
      payment_mode: "full",
      location: "centro",
      date: input.date,
      time: input.time,
      staff_id: staffId,
    };

    if (draftId && row) {
      const { data: written, error: writeError } = await db
        .from("bookings")
        .update({ ...slot, status: "pending" })
        .eq("id", draftId)
        .eq("status", "draft")
        .select("id");
      if (writeError) {
        return isSlotTaken(writeError)
          ? { kind: "slot_taken" }
          : { kind: "failed" };
      }
      // Another call promoted it between the read and the write: theirs is
      // the one that confirmed, and the one that records it.
      if (((written ?? []) as unknown[]).length === 0) {
        return { kind: "not_draft" };
      }

      // The visitor has no session, so nobody is named as the actor.
      // `anonymous` rather than `system`: a person did this, on the website.
      await recordBookingEvent({
        bookingId: draftId,
        channel: "system",
        event: "created",
        actorRole: "anonymous",
        summary: [
          "Reserva solicitada desde la web",
          slot.service_title,
          humanMoment(input.date, input.time),
        ]
          .filter(Boolean)
          .join(" · "),
      });
      await promoteToClient(
        db,
        await ownContact(db, input.contactId, input.email),
      );
      return { kind: "promoted", bookingId: draftId };
    }

    const contactId = await ownContact(db, input.contactId, input.email);
    const written = await insertBooking(
      db,
      { ...bookingColumns(input, tier, session, contactId), ...slot },
      "pending",
    );
    if ("error" in written) {
      if (isSlotTaken(written.error)) return { kind: "slot_taken" };
      console.error(
        "[booking] the booking could not be written:",
        written.error,
      );
      return { kind: "failed" };
    }
    await promoteToClient(db, contactId);
    return { kind: "created", bookingId: written.id };
  } catch (err) {
    console.error("[booking] the booking could not be confirmed:", err);
    return { kind: "failed" };
  }
}
