import { getAdminClient } from "@/lib/insforge-admin";
import { pushBookingToCalendars } from "@/lib/calendar-sync";
import { recordBookingEvent } from "@/lib/booking-events/record";
import { sendEmail } from "@/emails/send";
import { bookingConfirmationEmail } from "@/emails/templates/booking-confirmation";
import { fixedBlocksByKind } from "@/lib/messages/fixed-blocks";
import { emailOffSummary, OFF_REASON } from "@/lib/messages/off-note";
import { renderMessageEmail } from "@/lib/messages/render";
import { formatLongDate, formatPrice } from "@/utils/format";
import { notifyStaffOnWhatsApp } from "@/lib/whatsapp/notify";
import { notifyStaffOfPaidBooking } from "@/lib/bookings/notify-staff-paid";
import { pendingConsentUrl } from "@/lib/consent/server";
import { amountOwed, paymentStatusAfter } from "@/lib/payments/amounts";
import { notifyClientOnWhatsApp } from "@/lib/whatsapp/notify-client";
import { judgeArrival } from "@/lib/payments/duplicate-payment";
import { recordDuplicatePayment } from "@/lib/bookings/refunds";
import type { PaymentEntry } from "@/lib/bookings/refund-rules";

/**
 * Records money received through Redsys and notifies the client.
 *
 * `amountCents` is `Ds_Amount` from the notification: what the bank really
 * charged. Since 2026-11-24 that is the whole price (there is no deposit for a
 * new booking); a booking made with a deposit before then may still receive
 * part of its price here. A booking is `paid` only once the money covers it.
 *
 * This deliberately lives in `services/` and NOT in `actions/`: it used to be a
 * `"use server"` export, which made it a public HTTP endpoint that anyone could
 * call to mark an arbitrary booking as paid. It is only ever invoked
 * server-to-server from the Redsys webhook, after signature verification.
 */
export async function handleBookingPaid(
  bookingId: string,
  amountCents: number,
  /**
   * The Redsys order the notification is for. It may be an EARLIER checkout
   * than the one `stripe_session_id` holds (a second tab); without it, that
   * column is read, as before.
   */
  notifiedOrderId?: string,
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

  // Redsys retries its notification, so the status is not enough to tell a
  // retry: key on the order. One `payment/paid` (or `payment/duplicate`) entry
  // per Redsys order, ever. And a SECOND order authorised for a booking that
  // already holds money (two tabs, an old page) is a duplicate: recorded and
  // owed back, never added to the booking.
  const orderId =
    notifiedOrderId ?? (booking.stripe_session_id as string | null) ?? null;
  const received =
    Number.isFinite(amountCents) && amountCents > 0 ? amountCents / 100 : 0;
  if (orderId) {
    const arrival = judgeArrival(
      booking as { payment_status: string | null; amount_paid_eur: number },
      await paymentEntries(bookingId),
      orderId,
    );
    if (arrival.kind === "retry") return;
    if (arrival.kind === "duplicate") {
      await recordDuplicatePayment({
        bookingId,
        orderId,
        amountEur: received,
        firstOrderId: arrival.firstOrderId,
      });
      return;
    }
  }

  // The first money to arrive is what turns the request into a session someone
  // has to be there for; a second payment on the same booking is not news.
  const firstPayment =
    booking.payment_status !== "deposit_paid" &&
    booking.payment_status !== "paid";

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
  if (((applied ?? []) as unknown[]).length === 0) {
    // Another notification added money in between. If it was ANOTHER order,
    // this one is a duplicate; the same order arriving twice at once is a
    // retry, and is left alone. Judged again on what is now recorded.
    if (orderId) {
      const { data: now } = await adminClient.database
        .from("bookings")
        .select("payment_status, amount_paid_eur")
        .eq("id", bookingId)
        .maybeSingle();
      const again = judgeArrival(
        (now ?? booking) as {
          payment_status: string | null;
          amount_paid_eur: number;
        },
        await paymentEntries(bookingId),
        orderId,
      );
      if (again.kind === "duplicate" && again.firstOrderId) {
        await recordDuplicatePayment({
          bookingId,
          orderId,
          amountEur: received,
          firstOrderId: again.firstOrderId,
        });
      } else if (again.kind !== "retry") {
        console.warn("[handleBookingPaid] concurrent payment left alone", {
          bookingId,
          orderId,
        });
      }
    }
    return;
  }

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
  if (custom.kind === "skip") {
    // Switched off in the list of Messages: the payment stands, the client is
    // not written to, and the history says why (a client who paid and heard
    // nothing is exactly what the centre has to be able to explain).
    await recordBookingEvent({
      bookingId,
      channel: "email",
      event: "paid",
      actorRole: "system",
      recipient: booking.email as string,
      summary: emailOffSummary("booking_paid"),
      status: "skipped",
      error: OFF_REASON,
    });
  } else {
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

/** The booking's payment history, oldest first; empty when unreadable. */
async function paymentEntries(bookingId: string): Promise<PaymentEntry[]> {
  const { data } = await getAdminClient()
    .database.from("booking_events")
    .select("event, actor_role, provider_id, payload, created_at, status")
    .eq("booking_id", bookingId)
    .eq("channel", "payment")
    .order("created_at", { ascending: true });
  return (data ?? []) as PaymentEntry[];
}
