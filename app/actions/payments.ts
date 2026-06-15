"use server";

import { createClient } from "@insforge/sdk";
import { sendEmail } from "@/emails/send";
import { bookingConfirmationEmail } from "@/emails/templates/booking-confirmation";

function getAdminClient() {
  return createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.INSFORGE_SERVICE_KEY!,
    isServerMode: true,
  });
}

export async function handleBookingPaid(bookingId: string) {
  const adminClient = getAdminClient();
  const { data: booking } = await adminClient.database
    .from("bookings")
    .select("first_name, last_name, email, service_title, date, time, duration")
    .eq("id", bookingId)
    .single();

  if (!booking) {
    console.error("[handleBookingPaid] booking not found:", bookingId);
    return;
  }

  await adminClient.database
    .from("bookings")
    .update({ payment_status: "paid", status: "confirmed" })
    .eq("id", bookingId);

  // Sync contact record for paid web bookings
  try {
    await adminClient.database.from("contacts").upsert(
      {
        email: booking.email as string,
        first_name: booking.first_name as string,
        last_name: (booking.last_name as string | null) ?? null,
        status: "client",
      },
      { onConflict: "email" },
    );
  } catch {
    // fail-open
  }

  const { error } = await sendEmail({
    to: booking.email as string,
    subject: "Your Essentia booking is confirmed",
    html: bookingConfirmationEmail({
      name: booking.first_name as string,
      serviceName: booking.service_title as string,
      date: new Date(booking.date as string).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
      time: booking.time as string,
      duration: booking.duration as string,
      dateIso: booking.date as string,
    }),
  });

  if (error) {
    console.error("[handleBookingPaid] email failed:", error);
  }
}
