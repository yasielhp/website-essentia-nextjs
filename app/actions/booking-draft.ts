"use server";

import { getAdminClient } from "@/lib/insforge-admin";
import { AuthError, requireRole } from "@/lib/auth-guard";
import type { UpdateBookingPayload } from "@/types/booking";

export type { UpdateBookingPayload };

/**
 * Booking mutations.
 *
 * Two access models live here, and the distinction matters:
 *
 * - **Draft actions** run for anonymous visitors in the public booking flow, so
 *   they cannot require a role. Instead they are scoped to `status = 'draft'`,
 *   mirroring the `WHERE ... AND status = 'draft'` guard already present in the
 *   `update_booking_datetime` / `confirm_booking` SQL functions. Without it,
 *   knowing any booking id was enough to rewrite a confirmed booking.
 * - **Dashboard actions** require a staff role via the caller's access token.
 */

/** Attaches tier, price and notes to a booking that is still a draft. */
export async function updateDraftBookingMeta(
  bookingId: string,
  tierId: string | null,
  tierPrice: number | null,
  createdByUserId: string | null,
  createdByRole: string,
  notes: string | null,
  therapistGender: "male" | "female" | null = null,
): Promise<void> {
  if (!bookingId) return;

  const therapistNote =
    therapistGender === "male"
      ? "Terapeuta: Masculino"
      : therapistGender === "female"
        ? "Terapeuta: Femenina"
        : null;
  const composedNotes =
    [therapistNote, notes].filter(Boolean).join("\n\n") || null;

  await getAdminClient()
    .database.from("bookings")
    .update({
      tier_id: tierId,
      price_eur: tierPrice,
      location: "centro",
      ...(composedNotes ? { notes: composedNotes } : {}),
      ...(createdByUserId ? { created_by_user_id: createdByUserId } : {}),
      created_by_role: createdByRole,
    })
    .eq("id", bookingId)
    .eq("status", "draft");
}

/** Promotes a draft booking to `pending`. */
export async function confirmDraftBooking(
  bookingId: string,
  tierId: string | null,
  tierPrice: number | null,
  duration: string,
  date: string,
  time: string,
): Promise<void> {
  if (!bookingId) return;

  await getAdminClient()
    .database.from("bookings")
    .update({
      status: "pending",
      tier_id: tierId,
      price_eur: tierPrice,
      duration,
      location: "centro",
      date,
      time,
    })
    .eq("id", bookingId)
    .eq("status", "draft");
}

/** Deletes a booking outright. Staff only. */
export async function deleteBooking(
  accessToken: string | null,
  bookingId: string,
): Promise<{ error: string | null }> {
  try {
    await requireRole(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return { error: err.message };
    throw err;
  }

  if (!bookingId) return { error: "Falta el identificador de la reserva." };

  const { error } = await getAdminClient()
    .database.from("bookings")
    .delete()
    .eq("id", bookingId);

  return { error: (error as { message?: string } | null)?.message ?? null };
}

/** Full booking edit from the dashboard. Staff only. */
export async function updateBookingByAdmin(
  accessToken: string | null,
  bookingId: string,
  payload: UpdateBookingPayload,
): Promise<{ error: string | null }> {
  try {
    await requireRole(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return { error: err.message };
    throw err;
  }

  if (!bookingId) return { error: "Falta el identificador de la reserva." };

  const { error } = await getAdminClient()
    .database.from("bookings")
    .update(payload)
    .eq("id", bookingId);

  return { error: (error as { message?: string } | null)?.message ?? null };
}
