import { getAdminClient } from "@/lib/insforge-admin";
import { pushBookingToCalendars } from "@/lib/calendar-sync";
import { sendEmail } from "@/emails/send";
import { bookingConfirmationEmail } from "@/emails/templates/booking-confirmation";
import { formatLongDate } from "@/utils/format";

/**
 * Marks a booking as paid and notifies the client.
 *
 * This deliberately lives in `services/` and NOT in `actions/`: it used to be a
 * `"use server"` export, which made it a public HTTP endpoint that anyone could
 * call to mark an arbitrary booking as paid. It is only ever invoked
 * server-to-server from the Redsys webhook, after signature verification.
 */
export async function handleBookingPaid(bookingId: string): Promise<void> {
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

  // The booking has just become one somebody has to be there for, so it goes
  // on the calendars now rather than at the next quarter past the hour.
  await pushBookingToCalendars(bookingId);

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
    // fail-open: contact sync must not block payment confirmation
  }

  const { error } = await sendEmail({
    to: booking.email as string,
    subject: "Your Essentia booking is confirmed",
    html: bookingConfirmationEmail({
      name: booking.first_name as string,
      serviceName: booking.service_title as string,
      date: formatLongDate(booking.date as string, "en"),
      time: booking.time as string,
      duration: booking.duration as string,
      dateIso: booking.date as string,
    }),
  });

  if (error) {
    console.error("[handleBookingPaid] email failed:", error);
  }
}
