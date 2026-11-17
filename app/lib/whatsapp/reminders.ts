import { getAdminClient } from "@/lib/insforge-admin";
import {
  CLIENT_BOOKING_COLUMNS,
  CONTACT_COLUMNS,
  bookingLocale,
  clientBookingOf,
  clientPhone,
  deliverClientWhatsApp,
  hasClientConsent,
  loadClientMessageRows,
  loadClientTemplate,
  type ClientContact,
  type ClientWhatsAppDeps,
} from "./notify-client";
import { isWhatsAppConfigured, sendTemplateMessage } from "./client";
import { recordBookingEvent } from "@/lib/booking-events/record";
import type { WhatsAppTemplateRow } from "./types";

/**
 * The WhatsApp reminder to the client, for the hourly cron.
 *
 * Its own run, independent of the email's: it has its own stamp on the booking
 * (`whatsapp_reminder_sent_at`), so a reminder email that is switched off, or
 * already sent, says nothing about this one. The only way to switch THIS one
 * off is to delete its WhatsApp row (or switch that row off).
 *
 * At most once per booking: the booking is claimed with a conditional UPDATE
 * (`where whatsapp_reminder_sent_at is null returning id`) BEFORE anything is
 * sent, and only the run that wins it sends. The stamp is never taken back: a
 * refusal, a timeout or a throw leave it set, because a message to a client is
 * worth less retried every hour than missed once.
 *
 * Nothing here can break the cron: it never throws and the caller awaits it
 * after the email reminders are done.
 */

/** The same window as the email reminder: a session roughly two days away. */
const WINDOW_START_HOURS = 40;
const WINDOW_END_HOURS = 56;

/** Stops starting new sends past this, leaving the rest for the next hour. */
const DEFAULT_BUDGET_MS = 45_000;

export type ReminderRunResult = {
  sent: number;
  failed: number;
  skipped: number;
  lost: number;
  none: number;
};

type BookingRead = Parameters<typeof clientBookingOf>[0] & { id: string };
type ContactRead = ClientContact & { id: string; email: string | null };

const empty = (): ReminderRunResult => ({
  sent: 0,
  failed: 0,
  skipped: 0,
  lost: 0,
  none: 0,
});

export async function sendWhatsAppReminders(
  opts: { now?: number; budgetMs?: number; clock?: () => number } = {},
  injected?: ClientWhatsAppDeps,
): Promise<ReminderRunResult> {
  const result = empty();
  try {
    // Built inside the `try`: a database client that cannot be made must not
    // take the cron down.
    const deps: ClientWhatsAppDeps = injected ?? {
      db: getAdminClient().database,
      send: sendTemplateMessage,
      record: recordBookingEvent,
      isConfigured: isWhatsAppConfigured,
    };
    if (!deps.isConfigured()) return result;

    const rows = await loadClientMessageRows(deps.db, "booking_reminder");
    if (!rows) return result;

    const now = opts.now ?? Date.now();
    const clock = opts.clock ?? Date.now;
    const budgetMs = opts.budgetMs ?? DEFAULT_BUDGET_MS;
    const startedAt = clock();
    const dayOf = (hours: number) =>
      new Date(now + hours * 3_600_000).toISOString().slice(0, 10);

    // A date range first, so the query stays indexable; the exact hour is
    // checked below, where the booking's own time is known.
    const { data, error } = await deps.db
      .from("bookings")
      .select(`id, ${CLIENT_BOOKING_COLUMNS}`)
      .in("status", ["confirmed", "paid"])
      .gte("date", dayOf(WINDOW_START_HOURS))
      .lte("date", dayOf(WINDOW_END_HOURS))
      .is("whatsapp_reminder_sent_at", null);
    if (error) {
      console.error("[whatsapp/reminders] query failed:", error);
      return result;
    }

    const due = ((data ?? []) as BookingRead[]).filter((booking) => {
      if (!booking.date || !booking.time) return false;
      const startsInHours =
        (new Date(
          `${booking.date.slice(0, 10)}T${booking.time.slice(0, 5)}:00`,
        ).getTime() -
          now) /
        3_600_000;
      return (
        startsInHours >= WINDOW_START_HOURS && startsInHours <= WINDOW_END_HOURS
      );
    });
    if (due.length === 0) return result;

    const contacts = await loadContacts(deps.db, due);
    const templates = new Map<string, WhatsAppTemplateRow | null>();

    for (const booking of due) {
      if (clock() - startedAt > budgetMs) break;
      try {
        const facts = clientBookingOf(booking);
        if (!facts) continue;
        const contact =
          contacts.byEmail.get((booking.email ?? "").trim().toLowerCase()) ??
          (booking.contact_id ? contacts.byId.get(booking.contact_id) : null) ??
          null;
        const locale = bookingLocale(undefined, contact?.preferred_language);
        const row = rows.find((r) => r.locale === locale) ?? null;
        // Consent and a number first: no template is read for a client who
        // would not be messaged.
        if (
          !row ||
          !hasClientConsent(contact) ||
          !clientPhone(contact, facts)
        ) {
          result.none += 1;
          continue;
        }
        const templateId = row.whatsapp_template_id;
        if (templateId && !templates.has(templateId)) {
          templates.set(
            templateId,
            await loadClientTemplate(deps.db, templateId),
          );
        }

        const outcome = await deliverClientWhatsApp(
          {
            bookingId: booking.id,
            key: "booking_reminder",
            event: "reminded",
            locale,
            row,
            template: templateId ? (templates.get(templateId) ?? null) : null,
            contact,
            booking: facts,
            actorId: null,
            actorRole: "system",
            claim: () => claimBooking(deps.db, booking.id, now),
          },
          deps,
        );
        result[outcome] += 1;
      } catch (err) {
        // One booking's trouble is not the next one's.
        result.failed += 1;
        console.error("[whatsapp/reminders] booking failed:", booking.id, err);
      }
    }
  } catch (err) {
    console.error("[whatsapp/reminders] run failed:", err);
  }
  return result;
}

/**
 * The conditional UPDATE that decides which run sends: true only for the one
 * that moved the stamp from null. An error is thrown (and counted as lost by
 * the caller): without knowing who owns the booking, nobody may send.
 */
async function claimBooking(
  db: ClientWhatsAppDeps["db"],
  bookingId: string,
  now: number,
): Promise<boolean> {
  const { data, error } = await db
    .from("bookings")
    .update({ whatsapp_reminder_sent_at: new Date(now).toISOString() })
    .eq("id", bookingId)
    .is("whatsapp_reminder_sent_at", null)
    .select("id");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown[]).length > 0;
}

/** The contacts of a batch of bookings, by email (lowercased) and, failing that, by id. */
async function loadContacts(
  db: ClientWhatsAppDeps["db"],
  bookings: BookingRead[],
): Promise<{
  byEmail: Map<string, ContactRead>;
  byId: Map<string, ContactRead>;
}> {
  const byEmail = new Map<string, ContactRead>();
  const byId = new Map<string, ContactRead>();
  const columns = `id, email, ${CONTACT_COLUMNS}`;

  const emails = [
    ...new Set(
      bookings
        .map((b) => (b.email ?? "").trim().toLowerCase())
        .filter((email) => email !== ""),
    ),
  ];
  if (emails.length > 0) {
    const { data } = await db
      .from("contacts")
      .select(columns)
      .in("email", emails);
    for (const contact of (data ?? []) as ContactRead[]) {
      if (contact.email) byEmail.set(contact.email.toLowerCase(), contact);
    }
  }

  // Only for the bookings whose email matched no contact.
  const missing = [
    ...new Set(
      bookings
        .filter(
          (b) =>
            !byEmail.has((b.email ?? "").trim().toLowerCase()) && b.contact_id,
        )
        .map((b) => b.contact_id as string),
    ),
  ];
  if (missing.length > 0) {
    const { data } = await db
      .from("contacts")
      .select(columns)
      .in("id", missing);
    for (const contact of (data ?? []) as ContactRead[]) {
      byId.set(contact.id, contact);
    }
  }
  return { byEmail, byId };
}
