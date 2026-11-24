import { z } from "zod";
import { getAdminClient } from "@/lib/insforge-admin";
import { authenticate } from "@/lib/auth-guard";
import { recordBookingEvent } from "@/lib/booking-events/record";
import { bookableServices } from "@/data/services-data";
import { isValidPhone } from "@/utils/contact";
import { parseIsoDate } from "@/utils/format";
import { isSlotTaken } from "./slot-taken";

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
 * Three steps, the same three as before:
 *
 *   1. `savePublicDraftCore`, from the details step: starts the draft, or
 *      rewrites the one this visit already started (a corrected typo, a step
 *      back and forward) so one visit is one row.
 *   2. `setPublicDraftTimeCore`, from the calendar: the day and the hour.
 *   3. `confirmPublicBookingCore`, from the last step: the draft becomes a
 *      booking (`pending`, waiting for its payment), or a booking is written
 *      afresh when there is no draft any more.
 *
 * The third is where the professional's hour is defended: a booking that
 * holds a slot cannot overlap another of the same professional
 * (`bookings_no_overlap`, `slot-taken.ts`), so a second visitor confirming an
 * hour somebody has just taken is answered `slot_taken` and no payment is
 * opened. A draft holds nothing in the database; its hold on the calendar is
 * the courtesy of `holds-slot.ts`, as before.
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

export type SaveDraftResult =
  { ok: true; bookingId: string } | { ok: false; error: "invalid" | "failed" };

export type SetDraftTimeResult =
  { ok: true } | { ok: false; error: "invalid" | "failed" };

export type ConfirmPublicResult =
  /** Her draft is a booking now, made by this call. */
  | { kind: "promoted"; bookingId: string }
  /** She had no draft (or it was gone): a booking was written afresh. */
  | { kind: "created"; bookingId: string }
  /** The draft is past being a draft: confirmed elsewhere (another tab). */
  | { kind: "not_draft" }
  /** The professional's hour was taken by another booking in the meantime. */
  | { kind: "slot_taken" }
  /** The database did not answer: nothing is known. */
  | { kind: "failed" }
  /** Not what the form sends. */
  | { kind: "invalid" };

type Db = ReturnType<typeof getAdminClient>["database"];

type TierRow = {
  id: string;
  service_id: string | null;
  duration_minutes: number | null;
  price_eur: number | string | null;
  price_center_eur: number | string | null;
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
 * checked against the session type. `null` when either is not what the form
 * could have offered; `"failed"` when the database did not answer.
 */
async function readChoice(
  db: Db,
  input: { serviceId: string; tierId: string | null; staffId: string | null },
): Promise<{ tier: TierRow | null } | null | "failed"> {
  if (!bookableServices.some((s) => s.id === input.serviceId)) return null;
  if (!input.tierId) return input.staffId ? null : { tier: null };

  const { data, error } = await db
    .from("service_tiers")
    .select("id, service_id, duration_minutes, price_eur, price_center_eur")
    .eq("id", input.tierId)
    .maybeSingle();
  if (error) return "failed";
  const tier = data as TierRow | null;
  // A session type of another service would price this one by its rate.
  if (!tier || tier.service_id !== input.serviceId) return null;

  if (input.staffId) {
    // Only the people assigned to the session type are offered.
    const { data: assigned, error: staffError } = await db
      .from("staff_tiers")
      .select("staff_id")
      .eq("tier_id", input.tierId)
      .eq("staff_id", input.staffId)
      .maybeSingle();
    if (staffError) return "failed";
    if (!assigned) return null;
  }
  return { tier };
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

const priceOf = (tier: TierRow | null): number | null => {
  if (!tier) return null;
  // The web price; the checkout lowers it when the settings give a discount
  // for paying online.
  const value = tier.price_eur ?? tier.price_center_eur;
  return value === null || value === undefined ? null : Number(value);
};

const durationOf = (tier: TierRow | null): string =>
  tier?.duration_minutes != null ? `${tier.duration_minutes} min` : "";

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
  const serviceTitle =
    bookableServices.find((s) => s.id === input.serviceId)?.title ??
    input.serviceId;
  return {
    service_id: input.serviceId,
    service_title: serviceTitle,
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

/**
 * Step 1: who the booking is for, and what she chose.
 *
 * A draft holds no slot in the database (`bookings_no_overlap` leaves drafts
 * out), so this never meets the professional's hour.
 */
export async function savePublicDraftCore(
  session: PublicSession,
  raw: unknown,
): Promise<SaveDraftResult> {
  const parsed = publicDraftSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const input = parsed.data;

  try {
    const db = getAdminClient().database;
    const choice = await readChoice(db, input);
    if (choice === "failed") return { ok: false, error: "failed" };
    if (!choice) return { ok: false, error: "invalid" };

    const contactId = await ownContact(db, input.contactId, input.email);
    const columns = bookingColumns(input, choice.tier, session, contactId);

    if (input.draftId) {
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

/** Step 2: the day and the hour, on a booking that is still a draft. */
export async function setPublicDraftTimeCore(
  raw: unknown,
): Promise<SetDraftTimeResult> {
  const parsed = publicDraftTimeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { draftId, date, time } = parsed.data;
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
 * Her draft is promoted (`draft → pending`) only while it is still a draft, so
 * a replay or a second tab confirms nothing twice and only the call that
 * promoted it writes the history. With no draft (it was never written, or it
 * is gone) the booking is written afresh. Either write is where the database
 * refuses an hour another booking of that professional already holds.
 */
export async function confirmPublicBookingCore(
  session: PublicSession,
  raw: unknown,
): Promise<ConfirmPublicResult> {
  const parsed = publicConfirmSchema.safeParse(raw);
  if (!parsed.success) return { kind: "invalid" };
  const input = parsed.data;

  try {
    const db = getAdminClient().database;
    const choice = await readChoice(db, input);
    if (choice === "failed") return { kind: "failed" };
    if (!choice || !choice.tier) return { kind: "invalid" };
    const { tier } = choice;

    if (input.draftId) {
      const { data: before, error: readError } = await db
        .from("bookings")
        .select("status, service_title")
        .eq("id", input.draftId)
        .maybeSingle();
      if (readError) return { kind: "failed" };
      const row = before as {
        status: string | null;
        service_title: string | null;
      } | null;
      if (row && row.status !== "draft") return { kind: "not_draft" };

      if (row) {
        const { data: written, error: writeError } = await db
          .from("bookings")
          .update({
            status: "pending",
            tier_id: tier.id,
            duration: durationOf(tier),
            price_eur: priceOf(tier),
            payment_mode: "full",
            location: "centro",
            date: input.date,
            time: input.time,
            ...(input.staffId ? { staff_id: input.staffId } : {}),
          })
          .eq("id", input.draftId)
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
          bookingId: input.draftId,
          channel: "system",
          event: "created",
          actorRole: "anonymous",
          summary: [
            "Reserva solicitada desde la web",
            row.service_title?.trim(),
            humanMoment(input.date, input.time),
          ]
            .filter(Boolean)
            .join(" · "),
        });
        return { kind: "promoted", bookingId: input.draftId };
      }
    }

    const contactId = await ownContact(db, input.contactId, input.email);
    const written = await insertBooking(
      db,
      {
        ...bookingColumns(input, tier, session, contactId),
        date: input.date,
        time: input.time,
      },
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
    return { kind: "created", bookingId: written.id };
  } catch (err) {
    console.error("[booking] the booking could not be confirmed:", err);
    return { kind: "failed" };
  }
}
