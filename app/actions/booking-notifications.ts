"use server";

import { createClient } from "@insforge/sdk";
import { sendEmail } from "@/emails/send";
import { bookingReceivedEmail } from "@/emails/templates/booking-received";
import { bookingConfirmedEmail } from "@/emails/templates/booking-confirmed";
import { bookingCancelledEmail } from "@/emails/templates/booking-cancelled";
import { bookingRescheduledEmail } from "@/emails/templates/booking-rescheduled";
import { staffNewBookingEmail } from "@/emails/templates/staff-new-booking";

export type BookingNotificationEvent =
  | "received"
  | "confirmed"
  | "cancelled"
  | "rescheduled";

export type BookingNotificationPayload = {
  bookingId: string;
  event: BookingNotificationEvent;
  clientName: string;
  clientEmail: string;
  clientPhone?: string | null;
  service: string;
  serviceId?: string | null;
  sessionType?: string | null;
  date: string;
  time: string;
  duration?: string | null;
};

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

async function getStaffEmail(serviceId: string): Promise<string | null> {
  const adminClient = createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.INSFORGE_SERVICE_KEY!,
  });
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

export async function notifyBooking(
  payload: BookingNotificationPayload,
): Promise<void> {
  const {
    bookingId,
    event,
    clientName,
    clientEmail,
    clientPhone,
    service,
    serviceId,
    sessionType,
    duration,
  } = payload;

  const date = formatDate(payload.date);
  const time = payload.time;

  const dashboardUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://essentia.com";

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
      }),
    confirmed: () =>
      bookingConfirmedEmail({
        name: clientName,
        service,
        sessionType,
        date,
        time,
        duration,
      }),
    cancelled: () =>
      bookingCancelledEmail({
        name: clientName,
        service,
        sessionType,
        date,
        time,
        duration,
      }),
    rescheduled: () =>
      bookingRescheduledEmail({
        name: clientName,
        service,
        sessionType,
        date,
        time,
        duration,
      }),
  };

  const clientSubjects: Record<BookingNotificationEvent, string> = {
    received: `Solicitud recibida — ${service}`,
    confirmed: `Reserva confirmada — ${service}`,
    cancelled: `Reserva cancelada — ${service}`,
    rescheduled: `Reserva reprogramada — ${service}`,
  };

  await sendEmail({
    to: clientEmail,
    subject: clientSubjects[event],
    html: clientTemplates[event](),
  });

  // ── Staff notification (only on new bookings) ──────────────────
  if (event === "received" && serviceId) {
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
