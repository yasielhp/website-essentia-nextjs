"use server";

import { insforge } from "@/lib/insforge";
import { sendEmail } from "@/emails/send";
import { bookingConfirmationEmail } from "@/emails/templates/booking-confirmation";

export async function handleBookingPaid(bookingId: string) {
  const { data: booking } = await insforge.database
    .from("bookings")
    .select("first_name, last_name, email, service_title, date, time, duration")
    .eq("id", bookingId)
    .single();

  if (!booking) return;

  await insforge.database
    .from("bookings")
    .update({ payment_status: "paid" })
    .eq("id", bookingId);

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
    }),
  });

  if (error) {
    console.error("[handleBookingPaid] email failed:", error);
  }
}
