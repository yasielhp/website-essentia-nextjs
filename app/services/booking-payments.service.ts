import { getAdminClient } from "@/lib/insforge-admin";
import { pushBookingToCalendars } from "@/lib/calendar-sync";
import { recordBookingEvent } from "@/lib/booking-events/record";
import { sendEmail } from "@/emails/send";
import { bookingConfirmationEmail } from "@/emails/templates/booking-confirmation";
import { formatLongDate, formatPrice } from "@/utils/format";

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
    .select(
      // The price and the order number are for the history entry below: this
      // function is handed nothing but an id, and the row already knows what
      // was charged and which Redsys order paid it. That column is still
      // called `stripe_session_id` for historical reasons.
      "first_name, last_name, email, service_title, date, time, duration, price_eur, stripe_session_id",
    )
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

  const orderId = (booking.stripe_session_id as string | null) ?? null;
  // A numeric column can arrive as a string, and a booking with no price at all
  // must not be logged as one that cost nothing.
  const price = booking.price_eur as number | string | null;
  const charged = price == null ? 0 : Number(price);
  const amount = charged > 0 ? charged : null;

  await recordBookingEvent({
    bookingId,
    channel: "payment",
    event: "paid",
    // Nobody pressed anything: this arrives from Redsys' notification.
    actorRole: "system",
    summary:
      amount !== null
        ? `Pago recibido · ${formatPrice(amount, "es")}`
        : "Pago recibido",
    providerId: orderId,
    payload: { orderId, amountEur: amount, currency: "EUR" },
  });

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
