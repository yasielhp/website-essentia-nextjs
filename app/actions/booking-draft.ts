"use server";

import { createClient } from "@insforge/sdk";

function getAdminClient() {
  return createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.INSFORGE_SERVICE_KEY!,
    isServerMode: true,
  });
}

export async function updateDraftBookingMeta(
  bookingId: string,
  tierId: string | null,
  tierPrice: number | null,
  createdByUserId: string | null,
  createdByRole: string,
  notes: string | null,
  therapistGender: "male" | "female" | null = null,
): Promise<void> {
  const adminClient = getAdminClient();
  const therapistNote =
    therapistGender === "male"
      ? "Terapeuta: Masculino"
      : therapistGender === "female"
        ? "Terapeuta: Femenina"
        : null;
  const composedNotes =
    [therapistNote, notes].filter(Boolean).join("\n\n") || null;
  await adminClient.database
    .from("bookings")
    .update({
      tier_id: tierId,
      price_eur: tierPrice,
      location: "centro",
      ...(composedNotes ? { notes: composedNotes } : {}),
      ...(createdByUserId ? { created_by_user_id: createdByUserId } : {}),
      created_by_role: createdByRole,
    })
    .eq("id", bookingId);
}

export async function confirmDraftBooking(
  bookingId: string,
  tierId: string | null,
  tierPrice: number | null,
  duration: string,
  date: string,
  time: string,
): Promise<void> {
  const adminClient = getAdminClient();
  await adminClient.database
    .from("bookings")
    .update({
      status: "pending",
      tier_id: tierId,
      price_eur: tierPrice,
      duration,
      location: "centro",
      date,
      time,
    })
    .eq("id", bookingId);
}

export async function deleteBooking(bookingId: string): Promise<void> {
  const adminClient = getAdminClient();
  await adminClient.database.from("bookings").delete().eq("id", bookingId);
}

export type UpdateBookingPayload = {
  service_id: string;
  service_title: string;
  tier_id: string | null;
  price_eur: number | null;
  duration: string | null;
  date: string | null;
  time: string | null;
  location: string | null;
  location_address: string | null;
  notes: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: string;
};

export async function updateBookingByAdmin(
  bookingId: string,
  payload: UpdateBookingPayload,
): Promise<{ error: string | null }> {
  const adminClient = getAdminClient();
  const { error } = await adminClient.database
    .from("bookings")
    .update(payload)
    .eq("id", bookingId);
  return { error: (error as { message?: string } | null)?.message ?? null };
}
