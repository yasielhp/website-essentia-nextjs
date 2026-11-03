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
      "id, service_title, date, time, duration, status, payment_status, payment_mode, price_eur, amount_paid_eur, first_name, last_name, email, phone, contact_id, staff_id, location, location_address, notes, service_tiers(label, color)",
    )
    .eq("id", bookingId);
  if (auth.role === "partner") query = query.eq("partner_id", auth.userId);

  const { data } = await query.maybeSingle();
  if (!data) return null;
  const row = data as Omit<BookingPeek, "staff_name">;

  let staffName: string | null = null;
  if (row.staff_id) {
    const { data: profile } = await getAdminClient()
      .database.from("profiles")
      .select("first_name, last_name, full_name")
      .eq("id", row.staff_id)
      .maybeSingle();
    const p = profile as {
      first_name: string | null;
      last_name: string | null;
      full_name: string | null;
    } | null;
    staffName =
      p?.full_name?.trim() ||
      [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim() ||
      null;
  }
  return { ...row, staff_name: staffName };
}
