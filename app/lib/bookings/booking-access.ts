import { z } from "zod";
import { getAdminClient } from "@/lib/insforge-admin";
import type { AuthContext } from "@/lib/auth-guard";
import { hoursUntilSession } from "./cancellation-window";

/**
 * Which booking a member of the team may act on, from the server.
 *
 * With the browser's key the database decided it: admin and staff read every
 * booking, a partner only hers (`partner_id = auth.uid()`). The dashboard's
 * actions run with the service key, which bypasses that, so they must decide
 * it themselves, the same way: admin and staff any booking, a partner only her
 * own, anybody else none (`requireRole` keeps clients out before this). A
 * partner asking for somebody else's is told "forbidden" and nothing is read
 * back to her.
 *
 * Server only (it reads with the service key); the rules are pure and tested
 * on their own.
 */

export type BookingActor = Pick<AuthContext, "userId" | "role">;

/** A booking id as the dashboard sends it: a uuid, or the call is refused. */
export const bookingIdSchema = z.guid();

/** Whether this member of the team may act on a booking whose partner is `partnerId`. */
export function mayActOnBooking(
  actor: BookingActor,
  partnerId: string | null | undefined,
): boolean {
  if (actor.role === "admin" || actor.role === "staff") return true;
  if (actor.role === "partner") {
    return typeof partnerId === "string" && partnerId === actor.userId;
  }
  return false;
}

/**
 * How long before the session a partner may still edit it: more than 23 hours
 * and 59 minutes, the rule her screen has always applied (`canPartnerEdit` on
 * the booking's page and on its edit screen).
 */
export const PARTNER_EDIT_MIN_MINUTES = 23 * 60 + 59;

/**
 * Whether a partner may still edit a booking that starts at `date` + `time`,
 * counted on the Canary wall clock (`hoursUntilSession`), never the server's.
 * A booking with no day or no hour is editable, as on her screen.
 */
export function partnerMayEdit(
  date: string | null | undefined,
  time: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!date || !time) return true;
  return hoursUntilSession(date, time, now) * 60 > PARTNER_EDIT_MIN_MINUTES;
}

export type AccessibleBooking = {
  id: string;
  partner_id: string | null;
  staff_id: string | null;
  date: string | null;
  time: string | null;
};

export type BookingAccess =
  | { ok: true; booking: AccessibleBooking }
  | { ok: false; error: "invalid" | "not_found" | "forbidden" | "failed" };

/** Reads the booking and says whether `actor` may act on it. */
export async function bookingAccess(
  actor: BookingActor,
  bookingId: unknown,
): Promise<BookingAccess> {
  const id = bookingIdSchema.safeParse(bookingId);
  if (!id.success) return { ok: false, error: "invalid" };
  const { data, error } = await getAdminClient()
    .database.from("bookings")
    .select("id, partner_id, staff_id, date, time")
    .eq("id", id.data)
    .maybeSingle();
  if (error) return { ok: false, error: "failed" };
  const booking = data as AccessibleBooking | null;
  if (!booking) return { ok: false, error: "not_found" };
  if (!mayActOnBooking(actor, booking.partner_id)) {
    return { ok: false, error: "forbidden" };
  }
  return { ok: true, booking };
}

/**
 * Whether this member of the team may see a contact: admin and staff any, a
 * partner only a client of hers (a contact with at least one booking whose
 * `partner_id` is her, linked by the contact or by the address), anybody
 * else none. A partner reaches the contact page only from one of her own
 * bookings; the contacts list is not on her screens.
 */
export async function contactAccess(
  actor: BookingActor,
  contactId: unknown,
): Promise<boolean> {
  const id = bookingIdSchema.safeParse(contactId);
  if (!id.success) return false;
  if (actor.role === "admin" || actor.role === "staff") return true;
  if (actor.role !== "partner") return false;

  const db = getAdminClient().database;
  const { data: linked } = await db
    .from("bookings")
    .select("id")
    .eq("contact_id", id.data)
    .eq("partner_id", actor.userId)
    .limit(1);
  if (((linked ?? []) as unknown[]).length > 0) return true;

  const { data: contact } = await db
    .from("contacts")
    .select("email")
    .eq("id", id.data)
    .maybeSingle();
  const email = (contact as { email: string | null } | null)?.email?.trim();
  if (!email) return false;
  const { data: byAddress } = await db
    .from("bookings")
    .select("id")
    .ilike(
      "email",
      email.replace(/[\\%_]/g, (c) => `\\${c}`),
    )
    .eq("partner_id", actor.userId)
    .limit(1);
  return ((byAddress ?? []) as unknown[]).length > 0;
}
