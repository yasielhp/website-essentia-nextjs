import { getAdminClient } from "@/lib/insforge-admin";
import { pushBookingToCalendars } from "@/lib/calendar-sync";
import { recordBookingEvent } from "@/lib/booking-events/record";
import { sendEmail } from "@/emails/send";
import { bookingConfirmationEmail } from "@/emails/templates/booking-confirmation";
import { formatLongDate, formatPrice } from "@/utils/format";
import { amountOwed, paymentStatusAfter } from "@/lib/payments/amounts";

/**
 * Records money received through Redsys and notifies the client.
 *
 * `amountCents` is `Ds_Amount` from the notification: what the bank really
 * charged, which is a deposit and not `price_eur` since bookings can be paid in
 * part. A booking is `paid` only once the money covers its price.
 *
 * This deliberately lives in `services/` and NOT in `actions/`: it used to be a
 * `"use server"` export, which made it a public HTTP endpoint that anyone could
 * call to mark an arbitrary booking as paid. It is only ever invoked
 * server-to-server from the Redsys webhook, after signature verification.
 */
export async function handleBookingPaid(
  bookingId: string,
  amountCents: number,
): Promise<void> {
  const adminClient = getAdminClient();

  const { data: booking } = await adminClient.database
    .from("bookings")
    .select(
      // The order number is for the history entry below: this function is
      // handed an id and an amount, and the row knows which Redsys order paid
      // it. That column is still called `stripe_session_id` for historical
      // reasons.
      "first_name, last_name, email, service_title, date, time, duration, price_eur, amount_paid_eur, payment_status, stripe_session_id, contact_id",
    )
    .eq("id", bookingId)
    .single();

  if (!booking) {
    console.error("[handleBookingPaid] booking not found:", bookingId);
    return;
  }

  // Redsys retries its notification. A deposit leaves the booking in
  // `deposit_paid`, so checking the status is not enough: a retry would add the
  // money a second time. Key on the order id instead: one `payment/paid` event
  // per Redsys order, ever.
  const orderId = (booking.stripe_session_id as string | null) ?? null;
  if (orderId) {
    const { data: already } = await adminClient.database
      .from("booking_events")
      .select("id")
      .eq("booking_id", bookingId)
      .eq("channel", "payment")
      .eq("event", "paid")
      .eq("provider_id", orderId)
      .limit(1);
    if ((already ?? []).length > 0) return;
  }

  const received =
    Number.isFinite(amountCents) && amountCents > 0 ? amountCents / 100 : 0;
  // A numeric column can arrive as a string.
  const priceEur = booking.price_eur == null ? 0 : Number(booking.price_eur);
  const paidEur = Number(booking.amount_paid_eur ?? 0) + received;
  const paymentStatus = paymentStatusAfter(paidEur, priceEur);
  const owedEur = amountOwed(priceEur, paidEur);

  await adminClient.database
    .from("bookings")
    .update({
      payment_status: paymentStatus,
      amount_paid_eur: paidEur,
      status: "confirmed",
    })
    .eq("id", bookingId);

  await recordBookingEvent({
    bookingId,
    channel: "payment",
    event: "paid",
    // Nobody pressed anything: this arrives from Redsys' notification.
    actorRole: "system",
    summary:
      owedEur > 0
        ? `Depósito recibido · ${formatPrice(received, "es")} · pendiente ${formatPrice(owedEur, "es")}`
        : `Pago recibido · ${formatPrice(received, "es")}`,
    providerId: orderId,
    payload: { orderId, amountEur: received, owedEur, currency: "EUR" },
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

  const locale = await contactLocale(
    adminClient,
    booking.contact_id as string | null,
    booking.email as string,
  );
  const { error } = await sendEmail({
    to: booking.email as string,
    subject:
      locale === "es"
        ? "Tu reserva en Essentia está confirmada"
        : "Your Essentia booking is confirmed",
    html: bookingConfirmationEmail({
      name: booking.first_name as string,
      serviceName: booking.service_title as string,
      date: formatLongDate(booking.date as string, locale),
      time: booking.time as string,
      duration: booking.duration as string,
      dateIso: booking.date as string,
      locale,
      paidEur: received,
      owedEur,
    }),
  });

  if (error) {
    console.error("[handleBookingPaid] email failed:", error);
  }
}

async function contactLocale(
  client: ReturnType<typeof getAdminClient>,
  contactId: string | null,
  email: string,
): Promise<"en" | "es"> {
  const query = client.database.from("contacts").select("preferred_language");
  const { data } = contactId
    ? await query.eq("id", contactId).maybeSingle()
    : await query.ilike("email", email).maybeSingle();
  return (data as { preferred_language: string | null } | null)
    ?.preferred_language === "en"
    ? "en"
    : "es";
}
