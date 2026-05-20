"use server";

import { createClient } from "@insforge/sdk";

function getAdminClient() {
  return createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.INSFORGE_SERVICE_KEY!,
  });
}

export async function updateDraftBookingMeta(
  bookingId: string,
  tierId: string | null,
  tierPrice: number | null,
  createdByUserId: string | null,
  createdByRole: string,
  notes: string | null,
): Promise<void> {
  const adminClient = getAdminClient();
  await adminClient.database
    .from("bookings")
    .update({
      tier_id: tierId,
      price_eur: tierPrice,
      location: "centro",
      ...(notes ? { notes } : {}),
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
