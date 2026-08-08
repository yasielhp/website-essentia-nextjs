"use server";

import { getAdminClient } from "@/lib/insforge-admin";
import { ONLINE_PAYMENT_DISCOUNT_PERCENT, onlinePrice } from "@/lib/pricing";
import { AuthError, requireRole } from "@/lib/auth-guard";
import type { UpdateBookingPayload } from "@/types/booking";

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
  paymentMethod: "online" | "on-site" = "online",
): Promise<void> {
  if (!bookingId) return;

  const therapistNote =
    therapistGender === "male"
      ? "Terapeuta: Masculino"
      : therapistGender === "female"
        ? "Terapeuta: Femenina"
        : null;
  // Staff need to know at a glance whether the money is still to be collected.
  const paymentNote =
    paymentMethod === "on-site"
      ? "Pago: en el centro (precio íntegro)"
      : `Pago: online (−${ONLINE_PAYMENT_DISCOUNT_PERCENT}%)`;
  const composedNotes =
    [therapistNote, paymentNote, notes].filter(Boolean).join("\n\n") || null;

  // `price_eur` is what will actually be charged, so the transactions page
  // does not report the list price for a booking that paid the online rate.
  const amountEur =
    tierPrice != null && paymentMethod === "online"
      ? onlinePrice(tierPrice)
      : tierPrice;

  await getAdminClient()
    .database.from("bookings")
    .update({
      tier_id: tierId,
      price_eur: amountEur,
      location: "centro",
      ...(composedNotes ? { notes: composedNotes } : {}),
      ...(createdByUserId ? { created_by_user_id: createdByUserId } : {}),
      created_by_role: createdByRole,
    })
    .eq("id", bookingId)
    .eq("status", "draft");
}

/**
 * Rewrites the details of a draft the visitor already started.
 *
 * The booking flow used to call `create_draft_booking` every time the details
 * step was submitted, so going back a step and forward again — or correcting a
 * typo in an email — left the previous draft behind. One visitor produced eight
 * rows for what was plainly one attempt.
 *
 * Everything the earlier steps can still change is included, because the
 * visitor may have gone back past the details step and chosen another service
 * before returning.
 */
export async function updateDraftBookingDetails(
  bookingId: string,
  details: {
    contactId: string | null;
    userId: string | null;
    serviceId: string;
    serviceTitle: string;
    duration: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  },
): Promise<void> {
  if (!bookingId) return;

  await getAdminClient()
    .database.from("bookings")
    .update({
      // Only overwrite the links when we have one, so a failed upsert_contact
      // does not detach a draft that was already attached.
      ...(details.contactId ? { contact_id: details.contactId } : {}),
      ...(details.userId ? { user_id: details.userId } : {}),
      service_id: details.serviceId,
      service_title: details.serviceTitle,
      duration: details.duration,
      first_name: details.firstName,
      last_name: details.lastName,
      email: details.email,
      phone: details.phone,
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
