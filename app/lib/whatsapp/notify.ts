import { getAdminClient } from "@/lib/insforge-admin";
import {
  sendTemplate,
  toE164,
  WHATSAPP_TEMPLATE_LANGUAGE,
} from "@/lib/whatsapp/client";
import { buildStaffMessage } from "@/lib/whatsapp/messages";
import type { StaffWhatsAppInput } from "@/lib/whatsapp/types";

type Profile = {
  id: string;
  first_name: string | null;
  full_name: string | null;
  phone: string | null;
};

/**
 * Notifies a member of staff, on WhatsApp, about a booking of theirs — and
 * sends the admin the same message.
 *
 * The admin copy is a carbon copy, not a second message: identical wording,
 * addressed to the professional by name, so it reads as "this is what Yuli was
 * told". It mirrors what `sendEmail()` already does by BCC-ing the admin on
 * every transactional email, and it is what makes the log useful when a
 * professional says nothing arrived.
 *
 * SERVER ONLY, and deliberately **not** a Server Action: every export of a
 * `"use server"` module is a public HTTP endpoint, and this function carries no
 * role check. Exposed that way, anyone who guessed a booking id could make the
 * centre's number message its own staff. Callers that face the browser go
 * through `notifyStaffWhatsApp` in `app/actions/staff-whatsapp.ts`, which
 * requires a staff role; the anonymous booking and cancellation flows already
 * run on the server and import this directly.
 *
 * Nothing here is trusted from the caller beyond the two ids: the phones and
 * the names come from `profiles`, and the client, service and time come from
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
      .select("id, first_name, full_name, phone")
      .eq("id", staffId)
      .maybeSingle();

    const profile = profileData as Profile | null;
    if (!profile) return;

    // Every admin, not just the first: the centre may well end up with two, and
    // a notification that reaches only one of them is worse than none, because
    // nobody can tell which.
    const { data: adminData } = await db
      .from("profiles")
      .select("id, first_name, full_name, phone")
      .eq("role", "admin");

    // The professional first, so that a phone shared with an admin account is
    // recorded against the person the message is actually about.
    const recipients: { id: string; phone: string }[] = [];
    const seen = new Set<string>();
    for (const candidate of [profile, ...((adminData ?? []) as Profile[])]) {
      const phone = toE164(candidate.phone);
      // One person, one message: an admin who is also the assigned
      // professional would otherwise get the same text twice.
      if (!phone || seen.has(phone)) continue;
      seen.add(phone);
      recipients.push({ id: candidate.id, phone });
    }

    // No number anywhere means there is nothing to send and nothing worth
    // recording — the dashboard would only fill up with rows nobody can act on.
    if (recipients.length === 0) return;

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
      profile.first_name?.trim() ||
      profile.full_name?.trim().split(" ")[0] ||
      "";

    // Built once and reused: the admin reads the professional's message, so the
    // parameters must not be rebuilt around the admin's own name.
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

    // Sequential rather than parallel: two or three recipients at most, and
    // Meta throttles a new number hard enough that a burst is not worth the
    // risk of one send poisoning the others.
    for (const recipient of recipients) {
      const result = await sendTemplate({
        to: recipient.phone,
        params,
        buttonUrlParam,
      });

      await db.from("whatsapp_messages").insert([
        {
          booking_id: bookingId,
          staff_id: recipient.id,
          event,
          to_phone: recipient.phone,
          language: WHATSAPP_TEMPLATE_LANGUAGE,
          params,
          body_preview: bodyPreview,
          status: result.status,
          error: result.status === "failed" ? result.error : null,
          provider_id: result.status === "sent" ? result.providerId : null,
        },
      ]);
    }
  } catch {
    // fail-open: the booking is already saved, and a lost notification is not
    // worth an error the visitor or member of staff can do nothing about.
  }
}
