import { getAdminClient } from "@/lib/insforge-admin";
import {
  sendTemplate,
  toE164,
  WHATSAPP_TEMPLATE_LANGUAGE,
} from "@/lib/whatsapp/client";
import { buildStaffMessage } from "@/lib/whatsapp/messages";
import type { StaffWhatsAppInput } from "@/lib/whatsapp/types";

/**
 * Notifies a member of staff, on WhatsApp, about a booking of theirs.
 *
 * SERVER ONLY, and deliberately **not** a Server Action: every export of a
 * `"use server"` module is a public HTTP endpoint, and this function carries no
 * role check. Exposed that way, anyone who guessed a booking id could make the
 * centre's number message its own staff. Callers that face the browser go
 * through `notifyStaffWhatsApp` in `app/actions/staff-whatsapp.ts`, which
 * requires a staff role; the anonymous booking and cancellation flows already
 * run on the server and import this directly.
 *
 * Nothing here is trusted from the caller beyond the two ids: the phone and
 * the name come from `profiles`, and the client, service and time come from
 * `bookings`.
 *
 * It never throws. A WhatsApp problem must not undo a booking that is already
 * saved, so failures are recorded and swallowed.
 */
export async function notifyStaffOnWhatsApp(
  input: StaffWhatsAppInput,
): Promise<void> {
  const { bookingId, staffId, event } = input;
  if (!bookingId || !staffId) return;

  try {
    const db = getAdminClient().database;

    const { data: profileData } = await db
      .from("profiles")
      .select("first_name, full_name, phone")
      .eq("id", staffId)
      .maybeSingle();

    const profile = profileData as {
      first_name: string | null;
      full_name: string | null;
      phone: string | null;
    } | null;

    const to = toE164(profile?.phone);
    // No number on the profile means there is nothing to send and nothing
    // worth recording — the dashboard would only fill up with rows nobody can
    // act on.
    if (!to) return;

    const { data: bookingData } = await db
      .from("bookings")
      .select(
        "first_name, last_name, service_title, date, time, service_tiers(label)",
      )
      .eq("id", bookingId)
      .maybeSingle();

    const booking = bookingData as {
      first_name: string | null;
      last_name: string | null;
      service_title: string | null;
      date: string | null;
      time: string | null;
      service_tiers: { label: string | null } | null;
    } | null;
    if (!booking) return;

    const staffFirstName =
      profile?.first_name?.trim() ||
      profile?.full_name?.trim().split(" ")[0] ||
      "";

    const { params, bodyPreview, buttonUrlParam } = buildStaffMessage({
      event,
      staffFirstName,
      clientName: [booking.first_name, booking.last_name]
        .filter(Boolean)
        .join(" ")
        .trim(),
      service: booking.service_title ?? "",
      sessionType: booking.service_tiers?.label ?? null,
      date: booking.date,
      time: booking.time,
      bookingId,
    });

    const result = await sendTemplate({
      to,
      params,
      buttonUrlParam,
    });

    await db.from("whatsapp_messages").insert([
      {
        booking_id: bookingId,
        staff_id: staffId,
        event,
        to_phone: to,
        language: WHATSAPP_TEMPLATE_LANGUAGE,
        params,
        body_preview: bodyPreview,
        status: result.status,
        error: result.status === "failed" ? result.error : null,
        provider_id: result.status === "sent" ? result.providerId : null,
      },
    ]);
  } catch {
    // fail-open: the booking is already saved, and a lost notification is not
    // worth an error the visitor or member of staff can do nothing about.
  }
}
