import { getAdminClient } from "@/lib/insforge-admin";
import {
  sendTemplate,
  toE164,
  whatsAppTemplateName,
} from "@/lib/whatsapp/client";
import {
  buildStaffMessage,
  staffNoticeLanguage,
  type StaffMessageInput,
} from "@/lib/whatsapp/messages";
import type { StaffWhatsAppInput } from "@/lib/whatsapp/types";
import { recordBookingEvents } from "@/lib/booking-events/record";

type Profile = {
  id: string;
  first_name: string | null;
  full_name: string | null;
  phone: string | null;
  preferred_language: string | null;
};

type Db = ReturnType<typeof getAdminClient>["database"];

/**
 * Meta's codes of the template's versions that are APPROVED in the local copy
 * (`whatsapp_templates`, kept by the sync and the webhook). A read that fails
 * is no version: everybody gets the Spanish one, which has always worked.
 */
async function approvedTemplateCodes(db: Db): Promise<string[]> {
  try {
    const { data, error } = await db
      .from("whatsapp_templates")
      .select("language")
      .eq("name", whatsAppTemplateName())
      .eq("status", "APPROVED");
    if (error || !Array.isArray(data)) return [];
    return (data as { language: unknown }[])
      .map((row) => row.language)
      .filter((code): code is string => typeof code === "string");
  } catch {
    return [];
  }
}

/**
 * Notifies a member of staff, on WhatsApp, about a booking of theirs — and
 * sends the admin the same message.
 *
 * The admin copy is a carbon copy, not a second message: the same message,
 * addressed to the professional by name, so it reads as "this is what Yuli was
 * told". Each person reads it in the language of her own account, English
 * only once Meta has approved the English version (`staffNoticeLanguage`). It mirrors what `sendEmail()` already does by BCC-ing the admin on
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
  const { bookingId, staffId, event, actorId, actorRole } = input;
  if (!bookingId || !staffId) return;

  try {
    const db = getAdminClient().database;

    const { data: profileData } = await db
      .from("profiles")
      .select("id, first_name, full_name, phone, preferred_language")
      .eq("id", staffId)
      .maybeSingle();

    const profile = profileData as Profile | null;
    if (!profile) return;

    // Every admin, not just the first: the centre may well end up with two, and
    // a notification that reaches only one of them is worse than none, because
    // nobody can tell which.
    const { data: adminData } = await db
      .from("profiles")
      .select("id, first_name, full_name, phone, preferred_language")
      .eq("role", "admin");

    // The professional first, so that a phone shared with an admin account is
    // recorded against the person the message is actually about.
    const recipients: {
      id: string;
      phone: string;
      language: string | null;
    }[] = [];
    const seen = new Set<string>();
    for (const candidate of [profile, ...((adminData ?? []) as Profile[])]) {
      const phone = toE164(candidate.phone);
      // One person, one message: an admin who is also the assigned
      // professional would otherwise get the same text twice.
      if (!phone || seen.has(phone)) continue;
      seen.add(phone);
      recipients.push({
        id: candidate.id,
        phone,
        language: candidate.preferred_language,
      });
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

    // The same message for everybody: the admin reads the professional's, so
    // it is never rebuilt around the admin's own name, only in her language.
    const message: StaffMessageInput = {
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
    };

    // The local copy is read only when somebody's account is in English.
    const approved = recipients.some((r) =>
      (r.language ?? "").trim().toLowerCase().startsWith("en"),
    )
      ? await approvedTemplateCodes(db)
      : [];

    // All at once: two or three recipients at most, each send is a separate
    // message to a separate number, and `sendTemplate` never throws — a refusal
    // comes back as `{ status: "failed" }`, so one bad number cannot cancel the
    // others the way a rejection would.
    const sent = await Promise.all(
      recipients.map(async (recipient) => {
        const { language, code } = staffNoticeLanguage(
          recipient.language,
          approved,
        );
        const built = buildStaffMessage(message, language);
        return {
          recipient,
          code,
          built,
          result: await sendTemplate({
            to: recipient.phone,
            params: built.params,
            buttonUrlParam: built.buttonUrlParam,
            language: code,
          }),
        };
      }),
    );

    // One insert rather than one per recipient: the log is written after every
    // send has answered, so the dashboard never shows half a notification.
    await recordBookingEvents(
      sent.map(({ recipient, code, built, result }) => ({
        bookingId,
        channel: "whatsapp" as const,
        event,
        actorId,
        actorRole,
        recipientId: recipient.id,
        recipient: recipient.phone,
        // The text as the recipient sees it, worded here rather than rebuilt
        // from the parameters when somebody opens the booking.
        summary: built.bodyPreview,
        status: result.status,
        error: result.status === "failed" ? result.error : null,
        providerId: result.status === "sent" ? result.providerId : null,
        // Kept so a message that reads oddly can be traced back to the exact
        // template call, which the summary alone cannot reproduce.
        payload: { params: built.params, language: code },
      })),
    );
  } catch {
    // fail-open: the booking is already saved, and a lost notification is not
    // worth an error the visitor or member of staff can do nothing about.
  }
}
