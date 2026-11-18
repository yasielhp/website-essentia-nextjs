import { z } from "zod";
import { getAdminClient } from "@/lib/insforge-admin";
import { getAppUrl } from "@/lib/env";
import { sendEmail } from "@/emails/send";
import { bookingReceivedEmail } from "@/emails/templates/booking-received";
import { bookingConfirmedEmail } from "@/emails/templates/booking-confirmed";
import { bookingCancelledEmail } from "@/emails/templates/booking-cancelled";
import { bookingRescheduledEmail } from "@/emails/templates/booking-rescheduled";
import { staffNewBookingEmail } from "@/emails/templates/staff-new-booking";
import { fixedBlocksByKind } from "@/lib/messages/fixed-blocks";
import {
  LEGACY_BOOKING_SUBJECTS,
  type BookingNoticeKey,
} from "@/lib/messages/legacy-subjects";
import { emailOffSummary, OFF_REASON } from "@/lib/messages/off-note";
import type { NotifyOutcome } from "./notify-outcome";
import { renderMessageEmail } from "@/lib/messages/render";
import { pendingConsentUrl } from "@/lib/consent/server";
import { formatLongDate } from "@/lib/format-date";
import { recordBookingEvent } from "@/lib/booking-events/record";
import type { BookingEventActorRole } from "@/lib/booking-events/types";
import { notifyClientOnWhatsApp } from "@/lib/whatsapp/notify-client";

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
 * The shape of what `notifyBooking` is handed. It refuses as little as it can:
 * a field that can be done without, or read another way, never costs the
 * email (see `readBookingNotification`).
 */
const payloadShape = z.object({
  bookingId: z
    .string()
    .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
  event: z.enum(["received", "confirmed", "cancelled", "rescheduled"]),
  clientName: z.string(),
  // Never the recipient (that is read from the booking row) and never used:
  // an odd address here is no reason to leave a client without her email.
  clientEmail: z.string().max(320).catch(""),
  // Not printed in the client's email: one that cannot be right is left out.
  clientPhone: z.string().max(40).nullish().catch(null),
  service: z.string(),
  // The booking row's own is preferred anyway.
  serviceId: z.string().max(100).nullish().catch(null),
  sessionType: z.string().nullish(),
  // Whatever arrives: `amountOrNull` makes a number of it, or nothing.
  amountDueEur: z.unknown().optional(),
  // Null, or missing, is an empty one: the emails have always taken those.
  date: z
    .string()
    .max(40)
    .nullish()
    .transform((value) => value ?? ""),
  time: z
    .string()
    .nullish()
    .transform((value) => value ?? ""),
  duration: z.string().nullish(),
  // A language nobody writes in is the same as none stated.
  locale: z.enum(["en", "es"]).nullish().catch(null),
});

/**
 * The five texts the legacy emails print as they come, and the most each may
 * be: several times what the booking form and the dashboard send (a name, a
 * service title, "60 min", "10:30").
 */
const PRINTED = {
  clientName: 200,
  service: 200,
  sessionType: 200,
  time: 20,
  duration: 40,
} as const;

const MARKUP = /[<>]/g;
const CONTROL = /[\u0000-\u001f\u007f\u0085\u2028\u2029]+/g;
const NEEDS_CLEANING = /[<>\u0000-\u001f\u007f\u0085\u2028\u2029]/;

/**
 * A stranger's text as it may be printed: no `<` or `>`, a space where a line
 * break or another control character was, runs of spaces as one, no space at
 * the ends. A text that carries none of those is returned untouched, odd
 * spacing included, so the email it goes into is the one it always was.
 */
function printable(text: string): string {
  if (!NEEDS_CLEANING.test(text)) return text;
  return text
    .replace(MARKUP, "")
    .replace(CONTROL, " ")
    .replace(/ {2,}/g, " ")
    .trim();
}

/** More than any treatment costs: an amount above it is not an amount. */
const MAX_AMOUNT_EUR = 100_000;

/**
 * The amount as the emails may print it: a number, or nothing. The legacy
 * template and the fixed block both set it into HTML as it comes, so whatever
 * is not a number never gets that far, whoever the caller is.
 *
 * A number that arrived as text is read as the number it is (a `numeric`
 * column comes as a string, and a person writes the decimals after a comma):
 * digits, and at most one `.` or `,` with digits after it. Anything else, a
 * negative amount or one no treatment costs, is nothing: the email goes out
 * without the sentence about paying at the centre rather than not at all.
 */
function amountOrNull(value: unknown): number | null {
  const amount =
    typeof value === "string" && /^\d+(?:[.,]\d+)?$/.test(value.trim())
      ? Number(value.trim().replace(",", "."))
      : value;
  return typeof amount === "number" &&
    Number.isFinite(amount) &&
    amount >= 0 &&
    amount <= MAX_AMOUNT_EUR
    ? amount
    : null;
}

/** Why a payload was refused: where and what kind, never what it said. */
function logRefusal(reasons: string[]): void {
  console.error("[notifyBooking] payload refused, nothing sent:", reasons);
}

/**
 * What `notifyBooking` (the Server Action) was handed, as a payload that may
 * go on, or null when it cannot be made into one.
 *
 * A Server Action is a public endpoint and its TypeScript types are a wish, so
 * this is what stands between a hand-made request and an email signed by the
 * centre. It REPAIRS rather than refuses wherever it can, because refusing is
 * "send nothing" and a client must never be left without her email:
 *
 *  - the five printed texts are cut to their ceiling, on every event;
 *  - on `received`, the one event a stranger can send, they are also cleaned
 *    (`printable`): the legacy emails print them as they come, and a line
 *    break in the service would be one in the subject. The team's own events
 *    are not doubted that way;
 *  - the amount is read as a number if it is one in any form, else dropped;
 *  - a phone, a service id or an address that cannot be right is left out
 *    (none of them is printed in the client's email), a language nobody
 *    writes in is no language, and a null date or time is an empty one.
 *
 * Null only for what cannot be repaired: a booking id that is not one, an
 * event nobody sends, a printed text or a date of the wrong type, a date far
 * beyond any real one, and a `received` with no service left to write about.
 * Every refusal is logged (`console.error`) with the path and the code of
 * each problem and nothing of what was sent, because a refusal is an email
 * that does not go out and nothing else records it. Formats are left loose on
 * purpose (an empty date or time, a time the database wrote as `10:30:00`).
 * What needs no repair goes on exactly as it came.
 */
export function readBookingNotification(
  input: unknown,
): BookingNotificationPayload | null {
  const parsed = payloadShape.safeParse(input);
  if (!parsed.success) {
    logRefusal(
      parsed.error.issues.map(
        (issue) =>
          `${issue.path.map(String).join(".") || "(payload)"}: ${issue.code}`,
      ),
    );
    return null;
  }
  const { amountDueEur, locale, ...rest } = parsed.data;
  const payload: BookingNotificationPayload = {
    ...rest,
    // Only when it was sent, so what needs no repair is not added to.
    ...(amountDueEur === undefined
      ? {}
      : { amountDueEur: amountOrNull(amountDueEur) }),
    ...(locale ? { locale } : {}),
  };
  const anonymous = payload.event === "received";
  for (const [field, max] of Object.entries(PRINTED) as [
    keyof typeof PRINTED,
    number,
  ][]) {
    const text = payload[field];
    if (typeof text !== "string") continue;
    const clean = anonymous ? printable(text) : text;
    payload[field] = clean.length > max ? clean.slice(0, max).trimEnd() : clean;
  }
  if (anonymous && payload.service === "") {
    logRefusal(["service: empty"]);
    return null;
  }
  return payload;
}

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
 * Sends one email and leaves it in the booking history either way.
 *
 * Two things it fixes at once. The send used to leave no trace anywhere, so
 * "nobody told me" had nothing to answer it; and `sendEmail` throws on an
 * address the provider rejects, which used to travel all the way up and take
 * the caller down with it — on the public form, the reply to the person who had
 * just booked. Here a failure is a `failed` entry and nothing more.
 */
async function sendAndRecord(params: {
  bookingId: string;
  event: BookingNotificationEvent;
  to: string;
  subject: string;
  html: string;
  actorId: string | null;
  actorRole: BookingEventActorRole;
}): Promise<"sent" | "failed"> {
  const { bookingId, event, to, subject, html, actorId, actorRole } = params;

  // The subject is the line the dashboard shows, because it is what the client
  // actually saw in their inbox.
  const entry = {
    bookingId,
    channel: "email" as const,
    event,
    summary: subject,
    recipient: to,
    actorId,
    actorRole,
  };

  try {
    const { error, id } = await sendEmail({ to, subject, html });
    await recordBookingEvent(
      error
        ? { ...entry, status: "failed", error: error.message }
        : // Resend's id, kept so its webhook can find this row again when the
          // message is delivered, opened or bounces.
          { ...entry, status: "sent", providerId: id },
    );
    return error ? "failed" : "sent";
  } catch (err) {
    await recordBookingEvent({
      ...entry,
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    });
    return "failed";
  }
}

/**
 * Sends the client (and the service's calendar owner) the email for a booking
 * event, and records each in the booking's history.
 *
 * SERVER ONLY and with no check of who is asking: the dashboard's Server Action
 * (`notifyBooking`) checks the session first, and the MCP tools act for a
 * person they have already authenticated. The recipient is read from the
 * booking row, never from the payload, so a caller cannot make this write to an
 * address of its own choosing.
 */
export async function notifyBookingCore(
  payload: BookingNotificationPayload,
  actor: { actorId: string | null; actorRole: BookingEventActorRole },
): Promise<NotifyOutcome> {
  const {
    bookingId,
    event,
    clientName,
    clientPhone,
    service,
    sessionType,
    duration,
    locale = "en",
  } = payload;
  const amountDueEur = amountOrNull(payload.amountDueEur);

  const recipient = await getBookingRecipient(bookingId);
  // Nobody to write to: the client's email did not go.
  if (!recipient) return "failed";

  const clientEmail = recipient.email;
  const serviceId = recipient.serviceId ?? payload.serviceId;

  const date = formatLongDate(payload.date, locale);
  const time = payload.time;

  const dashboardUrl = getAppUrl();
  const cancelUrl = buildCancelUrl(recipient.cancelToken, locale);
  // Only the confirmation asks for the consent, and only of someone who has
  // not signed it yet.
  const consentUrl =
    event === "confirmed"
      ? await pendingConsentUrl({ email: recipient.email }, locale)
      : null;

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
        consentUrl,
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

  // The admin's version of the message, if they edited it. Without one, or if
  // anything about reading it fails, `legacy` and the email goes out exactly
  // as it always has.
  const messageKey: Record<BookingNotificationEvent, BookingNoticeKey> = {
    received: "booking_received",
    confirmed: "booking_confirmed",
    cancelled: "booking_cancelled",
    rescheduled: "booking_rescheduled",
  };
  // The subject it has always had: shared with the test that keeps the
  // editor's default subject equal to it.
  const legacySubject =
    LEGACY_BOOKING_SUBJECTS[locale][messageKey[event]](service);
  const custom = await renderMessageEmail({
    key: messageKey[event],
    locale,
    vars: {
      first_name: clientName,
      service,
      session_type: sessionType ?? "",
      date,
      time,
      duration: duration ?? "",
      // Written the way the legacy email prints it: a bare number with the
      // currency sign on the side the language puts it.
      amount_due:
        amountDueEur == null
          ? ""
          : locale === "es"
            ? `${amountDueEur}\u00a0€`
            : `€${amountDueEur}`,
      cancel_url: cancelUrl ?? "",
      consent_url: consentUrl ?? "",
    },
    blocks: () =>
      fixedBlocksByKind(messageKey[event], {
        locale,
        service,
        sessionType,
        date,
        time,
        duration,
        dateIso: payload.date,
        cancelUrl,
        consentUrl,
        amountDueEur,
      }),
  });

  let clientOutcome: NotifyOutcome;
  if (custom.kind === "skip") {
    // The admin switched this message off in the list of Messages: nothing is
    // sent to the client, and the history says so, so "nobody told me" has an
    // answer. The rest of the event (the contact, the staff, WhatsApp) goes on.
    await recordBookingEvent({
      bookingId,
      channel: "email",
      event,
      summary: emailOffSummary(messageKey[event]),
      recipient: clientEmail,
      status: "skipped",
      error: OFF_REASON,
      ...actor,
    });
    clientOutcome = "skipped";
  } else {
    clientOutcome = await sendAndRecord({
      bookingId,
      event,
      to: clientEmail,
      subject: custom.kind === "custom" ? custom.subject : legacySubject,
      html: custom.kind === "custom" ? custom.html : clientTemplates[event](),
      ...actor,
    });
  }

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

  // ── Staff notification ───────────────────────────────────────────
  // Not on `received`: a web booking exists before its payment does, and staff
  // are told by `notifyStaffOfPaidBooking` once the money is in.
  if (event === "confirmed" && serviceId) {
    const staffEmail = await getStaffEmail(serviceId).catch(() => null);
    if (staffEmail) {
      await sendAndRecord({
        bookingId,
        event,
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
        ...actor,
      });
    }
  }

  // ── Client WhatsApp ──────────────────────────────────────────────
  // Last, after everything above has been done and recorded: it is a second
  // channel for the same confirmation, and it only goes out for a client who
  // gave the booking-notice consent, to a template the admin chose for this
  // message. With none saved it costs one read. It never throws.
  if (event === "confirmed") {
    try {
      await notifyClientOnWhatsApp({
        bookingId,
        key: "booking_confirmed",
        event: "confirmed",
        // Only the caller's own word: when it did not say (the dashboard's
        // edit form), the client's stored language decides, not the `"en"`
        // the email falls back to.
        locale: payload.locale,
        ...actor,
      });
    } catch (err) {
      // It does not throw; this is for the day it does.
      console.error("[notifyBooking] client WhatsApp failed:", err);
    }
  }

  return clientOutcome;
}
