"use server";

import { getAdminClient } from "@/lib/insforge-admin";
import { AuthError, requireRole } from "@/lib/auth-guard";
import { getAppUrl } from "@/lib/env";
import { sendEmail } from "@/emails/send";
import { bookingReceivedEmail } from "@/emails/templates/booking-received";
import { bookingConfirmedEmail } from "@/emails/templates/booking-confirmed";
import { bookingCancelledEmail } from "@/emails/templates/booking-cancelled";
import { bookingRescheduledEmail } from "@/emails/templates/booking-rescheduled";
import { staffNewBookingEmail } from "@/emails/templates/staff-new-booking";
import { formatLongDate } from "@/lib/format-date";

export type BookingNotificationEvent =
  "received" | "confirmed" | "cancelled" | "rescheduled";

export type BookingNotificationPayload = {
  bookingId: string;
  event: BookingNotificationEvent;
  clientName: string;
  clientEmail: string;
  clientPhone?: string | null;
  service: string;
  serviceId?: string | null;
  sessionType?: string | null;
  /** Only for bookings paying at the centre: what is still owed. */
  amountDueEur?: number | null;
  date: string;
  time: string;
  duration?: string | null;
  locale?: "en" | "es";
};

/**
 * Resolves the recipient from the booking row rather than trusting the caller.
 *
 * The public booking flow calls `notifyBooking` anonymously, so the payload is
 * attacker-controlled. Sending to a caller-supplied address would turn this
 * action into an open relay for mail signed by the Essentia domain.
 */
async function getBookingRecipient(bookingId: string): Promise<{
  email: string;
  serviceId: string | null;
  cancelToken: string | null;
} | null> {
  if (!bookingId) return null;
  const { data } = await getAdminClient()
    .database.from("bookings")
    .select("email, service_id, cancel_token")
    .eq("id", bookingId)
    .maybeSingle();
  const row = data as {
    email: string | null;
    service_id: string | null;
    cancel_token: string | null;
  } | null;
  if (!row?.email) return null;
  return {
    email: row.email,
    serviceId: row.service_id,
    cancelToken: row.cancel_token,
  };
}

/**
 * The link that cancels this booking from an inbox.
 *
 * Spanish speakers get the Spanish route: the email is already in their
 * language, and bouncing them through the English URL first would be odd.
 */
function buildCancelUrl(
  token: string | null,
  locale: "en" | "es",
): string | null {
  if (!token) return null;
  const base = getAppUrl();
  return locale === "es"
    ? `${base}/es/reserva/cancelar?token=${token}`
    : `${base}/booking/cancel?token=${token}`;
}

async function upsertContact(
  email: string,
  firstName: string,
  lastName: string,
  phone: string | null | undefined,
  status: "lead" | "client",
): Promise<void> {
  try {
    const [first_name, ...rest] = firstName.trim().split(" ");
    const last_name = lastName.trim() || rest.join(" ") || null;
    await getAdminClient()
      .database.from("contacts")
      .upsert(
        {
          email,
          first_name: first_name ?? "",
          last_name,
          phone: phone ?? null,
          status,
        },
        { onConflict: "email" },
      );
  } catch {
    // fail-open: contact sync must not block the notification flow
  }
}

async function getStaffEmail(serviceId: string): Promise<string | null> {
  const adminClient = getAdminClient();
  const { data } = await adminClient.database
    .from("service_configs")
    .select("google_connected_email")
    .eq("service_id", serviceId)
    .limit(1)
    .single();
  return (
    (data as { google_connected_email: string | null } | null)
      ?.google_connected_email ?? null
  );
}

/**
 * Sends the client (and optionally staff) email for a booking event.
 *
 * `received` is reachable from the public booking flow, so it is allowed
 * anonymously but the recipient is read from the booking row. Every other event
 * is a staff operation and requires a dashboard role.
 */
export async function notifyBooking(
  accessToken: string | null,
  payload: BookingNotificationPayload,
): Promise<void> {
  const {
    bookingId,
    event,
    clientName,
    clientPhone,
    service,
    sessionType,
    duration,
    amountDueEur,
    locale = "en",
  } = payload;

  if (event !== "received") {
    try {
      await requireRole(accessToken);
    } catch (err) {
      if (err instanceof AuthError) return;
      throw err;
    }
  }

  const recipient = await getBookingRecipient(bookingId);
  if (!recipient) return;

  const clientEmail = recipient.email;
  const serviceId = recipient.serviceId ?? payload.serviceId;

  const date = formatLongDate(payload.date, locale);
  const time = payload.time;

  const dashboardUrl = getAppUrl();
  const cancelUrl = buildCancelUrl(recipient.cancelToken, locale);

  // ── Client emails ──────────────────────────────────────────────
  const clientTemplates: Record<BookingNotificationEvent, () => string> = {
    received: () =>
      bookingReceivedEmail({
        name: clientName,
        service,
        sessionType,
        date,
        time,
        duration,
        amountDueEur,
        cancelUrl,
        locale,
      }),
    confirmed: () =>
      bookingConfirmedEmail({
        name: clientName,
        service,
        sessionType,
        date,
        time,
        duration,
        dateIso: payload.date,
        cancelUrl,
        locale,
      }),
    cancelled: () =>
      bookingCancelledEmail({
        name: clientName,
        service,
        sessionType,
        date,
        time,
        duration,
        locale,
      }),
    rescheduled: () =>
      bookingRescheduledEmail({
        name: clientName,
        service,
        sessionType,
        date,
        time,
        duration,
        dateIso: payload.date,
        cancelUrl,
        locale,
      }),
  };

  const clientSubjects: Record<BookingNotificationEvent, string> =
    locale === "es"
      ? {
          received: `Solicitud de reserva recibida — ${service}`,
          confirmed: `Tu reserva ha sido confirmada — ${service}`,
          cancelled: `Reserva cancelada — ${service}`,
          rescheduled: `Sesión reprogramada — ${service}`,
        }
      : {
          received: `Booking request received — ${service}`,
          confirmed: `Booking confirmed — ${service}`,
          cancelled: `Booking cancelled — ${service}`,
          rescheduled: `Booking rescheduled — ${service}`,
        };

  await sendEmail({
    to: clientEmail,
    subject: clientSubjects[event],
    html: clientTemplates[event](),
  });

  // ── Sync contact record ────────────────────────────────────────
  if (event === "received" || event === "confirmed") {
    const [firstName, ...lastParts] = clientName.trim().split(" ");
    void upsertContact(
      clientEmail,
      firstName ?? clientName,
      lastParts.join(" "),
      clientPhone,
      "client",
    );
  }

  // ── Staff notification (on new bookings, whether pending or confirmed) ───
  if ((event === "received" || event === "confirmed") && serviceId) {
    const staffEmail = await getStaffEmail(serviceId).catch(() => null);
    if (staffEmail) {
      await sendEmail({
        to: staffEmail,
        subject: `New booking — ${clientName} · ${service}`,
        html: staffNewBookingEmail({
          clientName,
          clientEmail,
          clientPhone,
          service,
          sessionType,
          date,
          time,
          duration,
          bookingId,
          dashboardUrl,
        }),
      });
    }
  }
}
