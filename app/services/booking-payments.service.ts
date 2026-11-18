import { getAdminClient } from "@/lib/insforge-admin";
import { pushBookingToCalendars } from "@/lib/calendar-sync";
import { recordBookingEvent } from "@/lib/booking-events/record";
import { sendEmail } from "@/emails/send";
import { bookingConfirmationEmail } from "@/emails/templates/booking-confirmation";
import { fixedBlocksByKind } from "@/lib/messages/fixed-blocks";
import { renderMessageEmail } from "@/lib/messages/render";
import { formatLongDate, formatPrice } from "@/utils/format";
import { notifyStaffOnWhatsApp } from "@/lib/whatsapp/notify";
import { notifyStaffOfPaidBooking } from "@/lib/bookings/notify-staff-paid";
import { pendingConsentUrl } from "@/lib/consent/server";
import { amountOwed, paymentStatusAfter } from "@/lib/payments/amounts";
import { notifyClientOnWhatsApp } from "@/lib/whatsapp/notify-client";

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
      "first_name, last_name, email, service_title, date, time, duration, price_eur, amount_paid_eur, payment_status, status, stripe_session_id, contact_id, staff_id",
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

  // The first money to arrive is what turns the request into a session someone
  // has to be there for; a second payment on the same booking is not news.
  const firstPayment =
    booking.payment_status !== "deposit_paid" &&
    booking.payment_status !== "paid";

  const received =
    Number.isFinite(amountCents) && amountCents > 0 ? amountCents / 100 : 0;
  // A numeric column can arrive as a string.
  const priceEur = booking.price_eur == null ? 0 : Number(booking.price_eur);
  const paidEur = Number(booking.amount_paid_eur ?? 0) + received;
  const paymentStatus = paymentStatusAfter(paidEur, priceEur);
  const owedEur = amountOwed(priceEur, paidEur);

  // Conditioned on the amount read above: two notifications arriving together
  // both pass the event check, and only one of them may add the money.
  const { data: applied } = await adminClient.database
    .from("bookings")
    .update({
      payment_status: paymentStatus,
      amount_paid_eur: paidEur,
      status: "confirmed",
    })
    .eq("id", bookingId)
    .eq("amount_paid_eur", Number(booking.amount_paid_eur ?? 0))
    .select("id");
  if (((applied ?? []) as unknown[]).length === 0) return;

  // The money wins: a booking the cron released as unpaid comes back when the
  // bank finally answers. But its hour may have been given to somebody else in
  // between, so the entry says so and the staff notice below goes out.
  const revived = booking.status === "cancelled";
  await recordBookingEvent({
    bookingId,
    channel: "payment",
    event: "paid",
    // Nobody pressed anything: this arrives from Redsys' notification.
    actorRole: "system",
    summary:
      (owedEur > 0
        ? `Depósito recibido · ${formatPrice(received, "es")} · pendiente ${formatPrice(owedEur, "es")}`
        : `Pago recibido · ${formatPrice(received, "es")}`) +
      (revived
        ? " · la reserva había caducado: comprobar que la hora sigue libre"
        : ""),
    providerId: orderId,
    payload: { orderId, amountEur: received, owedEur, currency: "EUR" },
  });

  // The booking has just become one somebody has to be there for, so it goes
  // on the calendars now rather than at the next quarter past the hour.
  await pushBookingToCalendars(bookingId);

  if (firstPayment) {
    await notifyStaffOfPaidBooking(bookingId);
    if (booking.staff_id) {
      await notifyStaffOnWhatsApp({
        bookingId,
        staffId: booking.staff_id as string,
        event: "assigned",
      });
    }
  }

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
  const consentUrl = await pendingConsentUrl(
    {
      contactId: booking.contact_id as string | null,
      email: booking.email as string,
    },
    locale,
  );
  const date = formatLongDate(booking.date as string, locale);
  const legacySubject =
    locale === "es"
      ? "Tu reserva en Essentia está confirmada"
      : "Your Essentia booking is confirmed";
  // The admin's version of the message, if they edited it; otherwise (or if
  // reading it fails) `legacy` and the email goes out as it always has.
  const custom = await renderMessageEmail({
    key: "booking_paid",
    locale,
    vars: {
      first_name: booking.first_name as string,
      service: booking.service_title as string,
      date,
      time: booking.time as string,
      duration: booking.duration as string,
      amount_paid: received > 0 ? formatPrice(received, locale) : "",
      amount_due: owedEur > 0 ? formatPrice(owedEur, locale) : "",
      consent_url: consentUrl ?? "",
    },
    blocks: () =>
      fixedBlocksByKind("booking_paid", {
        locale,
        service: booking.service_title as string,
        date,
        time: booking.time as string,
        duration: booking.duration as string,
        dateIso: booking.date as string,
        paidEur: received,
        owedEur,
        consentUrl,
      }),
  });
  const { error } = await sendEmail({
    to: booking.email as string,
    subject: custom.kind === "custom" ? custom.subject : legacySubject,
    html:
      custom.kind === "custom"
        ? custom.html
        : bookingConfirmationEmail({
            name: booking.first_name as string,
            serviceName: booking.service_title as string,
            date,
            time: booking.time as string,
            duration: booking.duration as string,
            dateIso: booking.date as string,
            locale,
            paidEur: received,
            owedEur,
            consentUrl,
          }),
  });

  if (error) {
    console.error("[handleBookingPaid] email failed:", error);
  }

  // The WhatsApp confirmation, last and only for the FIRST payment: unlike the
  // email, a deposit followed by the balance must not message the client twice.
  // It needs a saved WhatsApp row for this message and the client's
  // booking-notice consent, costs one read when there is none, and never
  // throws.
  if (firstPayment) {
    try {
      await notifyClientOnWhatsApp({
        bookingId,
        key: "booking_paid",
        event: "paid",
        locale,
        actorRole: "system",
      });
    } catch (err) {
      // It does not throw; this is for the day it does.
      console.error("[handleBookingPaid] client WhatsApp failed:", err);
    }
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
    : await query.eq("email", email.trim().toLowerCase()).maybeSingle();
  return (data as { preferred_language: string | null } | null)
    ?.preferred_language === "en"
    ? "en"
    : "es";
}
