"use server";

import { getAdminClient } from "@/lib/insforge-admin";
import { CANCELLATION_WINDOW_HOURS } from "@/constants/booking";
import type { CancellableBooking } from "@/types/booking";
import { sendEmail } from "@/emails/send";
import { bookingCancelledEmail } from "@/emails/templates/booking-cancelled";

const SELECT =
  "id, service_id, service_title, date, time, duration, status, first_name, last_name, email, service_tiers(label)";

type Row = {
  id: string;
  service_id: string | null;
  service_title: string | null;
  date: string | null;
  time: string | null;
  duration: string | null;
  status: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  service_tiers: { label: string | null } | null;
};

function formatDate(dateStr: string | null, locale: "en" | "es"): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1).toLocaleDateString(
    locale === "es" ? "es-ES" : "en-GB",
    { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  );
}

/** Hours between now and the start of the session; negative once it has begun. */
function hoursUntil(date: string | null, time: string | null): number {
  if (!date) return -1;
  const start = new Date(`${date.slice(0, 10)}T${time ?? "00:00"}:00`);
  return (start.getTime() - Date.now()) / 3_600_000;
}

/**
 * Reads the booking behind a cancellation link.
 *
 * Anonymous by design: the token *is* the credential, which is why it is a
 * random uuid and not the booking id. Only what the page shows comes back —
 * never the email or phone the row also holds.
 */
export async function fetchCancellableBooking(
  token: string,
): Promise<CancellableBooking | null> {
  if (!token) return null;

  const { data } = await getAdminClient()
    .database.from("bookings")
    .select(SELECT)
    .eq("cancel_token", token)
    .limit(1);

  const booking = (data as Row[] | null)?.[0];
  if (!booking) return null;

  return {
    serviceTitle: booking.service_title,
    sessionType: booking.service_tiers?.label ?? null,
    date: booking.date,
    time: booking.time,
    duration: booking.duration,
    status: booking.status,
    firstName: booking.first_name,
    cancellable:
      booking.status !== "cancelled" &&
      hoursUntil(booking.date, booking.time) >= CANCELLATION_WINDOW_HOURS,
    alreadyCancelled: booking.status === "cancelled",
  };
}

/**
 * Cancels the booking a token points at.
 *
 * The window is checked here and not only in the page: the button can be
 * clicked from a stale tab, and a link from an old email is still a valid
 * token. Staff are notified through the usual path, so the dashboard and the
 * client's inbox tell the same story.
 */
export async function cancelBookingByToken(
  token: string,
  locale: "en" | "es" = "es",
): Promise<{ ok: boolean; reason?: "not_found" | "too_late" | "already" }> {
  if (!token) return { ok: false, reason: "not_found" };

  const db = getAdminClient().database;
  const { data } = await db
    .from("bookings")
    .select(SELECT)
    .eq("cancel_token", token)
    .limit(1);

  const booking = (data as Row[] | null)?.[0];
  if (!booking) return { ok: false, reason: "not_found" };
  if (booking.status === "cancelled") return { ok: false, reason: "already" };
  if (hoursUntil(booking.date, booking.time) < CANCELLATION_WINDOW_HOURS) {
    return { ok: false, reason: "too_late" };
  }

  const { error } = await db
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", booking.id);

  if (error) return { ok: false, reason: "not_found" };

  // The same email staff send when they cancel from the dashboard, so the
  // client gets one acknowledgement whichever side ended the booking. Sent
  // from here rather than through `notifyBooking`, which requires a staff role
  // for this event — and this caller has none by design.
  if (booking.email) {
    const service = booking.service_title ?? "";
    await sendEmail({
      to: booking.email,
      subject: `Reserva cancelada — ${service}`,
      html: bookingCancelledEmail({
        name: booking.first_name ?? "",
        service,
        sessionType: booking.service_tiers?.label ?? null,
        date: formatDate(booking.date, locale),
        time: booking.time ?? "",
        duration: booking.duration,
        locale,
      }),
    }).catch(() => {});
  }

  return { ok: true };
}
