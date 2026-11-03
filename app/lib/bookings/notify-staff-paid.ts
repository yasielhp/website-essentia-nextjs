import { getAdminClient } from "@/lib/insforge-admin";
import { getAppUrl } from "@/lib/env";
import { sendEmail } from "@/emails/send";
import { staffNewBookingEmail } from "@/emails/templates/staff-new-booking";
import { formatLongDate } from "@/lib/format-date";
import { recordBookingEvent } from "@/lib/booking-events/record";

/**
 * Tells the service's calendar owner about a web booking, once it is paid.
 *
 * This used to go out with the client's "request received" email, before the
 * client had reached the bank, so staff were alerted about bookings that were
 * then abandoned. SERVER ONLY and not a Server Action: it carries no role
 * check and is called from the payment webhook. Never throws.
 */
export async function notifyStaffOfPaidBooking(
  bookingId: string,
): Promise<void> {
  try {
    const db = getAdminClient().database;
    const { data } = await db
      .from("bookings")
      .select(
        "service_id, service_title, first_name, last_name, email, phone, date, time, duration, service_tiers(label)",
      )
      .eq("id", bookingId)
      .maybeSingle();
    const row = data as {
      service_id: string | null;
      service_title: string | null;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      phone: string | null;
      date: string | null;
      time: string | null;
      duration: string | null;
      service_tiers: { label: string | null } | null;
    } | null;
    if (!row?.service_id || !row.email) return;

    const { data: config } = await db
      .from("service_configs")
      .select("google_connected_email")
      .eq("service_id", row.service_id)
      .limit(1)
      .single();
    const staffEmail =
      (config as { google_connected_email: string | null } | null)
        ?.google_connected_email ?? null;
    if (!staffEmail) return;

    const clientName = [row.first_name, row.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    const service = row.service_title ?? "";
    const subject = `New booking — ${clientName} · ${service}`;
    const entry = {
      bookingId,
      channel: "email" as const,
      event: "received" as const,
      summary: subject,
      recipient: staffEmail,
      actorId: null,
      actorRole: "system" as const,
    };

    try {
      const { error, id } = await sendEmail({
        to: staffEmail,
        subject,
        html: staffNewBookingEmail({
          clientName,
          clientEmail: row.email,
          clientPhone: row.phone,
          service,
          sessionType: row.service_tiers?.label ?? null,
          date: formatLongDate(row.date, "es"),
          time: row.time ?? "",
          duration: row.duration,
          bookingId,
          dashboardUrl: getAppUrl(),
        }),
      });
      await recordBookingEvent(
        error
          ? { ...entry, status: "failed", error: error.message }
          : { ...entry, status: "sent", providerId: id },
      );
    } catch (err) {
      await recordBookingEvent({
        ...entry,
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  } catch (err) {
    console.error("[notifyStaffOfPaidBooking] failed:", err);
  }
}
