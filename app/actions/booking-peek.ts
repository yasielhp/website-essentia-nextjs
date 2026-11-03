"use server";

import { AuthError, requireRole } from "@/lib/auth-guard";
import { getAdminClient } from "@/lib/insforge-admin";
import type { BookingPeek } from "@/types/booking";

/**
 * One booking, for the side sheet that opens from the calendar.
 *
 * Read with the service key so the sheet shows the same fields to every
 * dashboard role, but a partner is narrowed to their own bookings, as the list
 * page already does.
 */
export async function fetchBookingPeek(
  accessToken: string | null,
  bookingId: string,
): Promise<BookingPeek | null> {
  let auth;
  try {
    auth = await requireRole(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return null;
    throw err;
  }
  if (!bookingId) return null;

  let query = getAdminClient()
    .database.from("bookings")
    .select(
      "id, service_title, date, time, duration, status, payment_status, payment_mode, price_eur, amount_paid_eur, first_name, last_name, email, phone, contact_id, staff_id, notes, service_tiers(label, color)",
    )
    .eq("id", bookingId);
  if (auth.role === "partner") query = query.eq("partner_id", auth.userId);

  const { data } = await query.maybeSingle();
  return (data as BookingPeek | null) ?? null;
}
