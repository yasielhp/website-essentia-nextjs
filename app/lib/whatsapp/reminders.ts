import {
  REMINDER_WINDOW_END_HOURS,
  REMINDER_WINDOW_START_HOURS,
} from "@/lib/bookings/reminder-window";
import { getAdminClient } from "@/lib/insforge-admin";
import {
  CLIENT_BOOKING_COLUMNS,
  CONTACT_COLUMNS,
  bookingLocale,
  clientBookingOf,
  clientRecipient,
  deliverClientWhatsApp,
  loadClientMessageRows,
  loadClientTemplate,
  makeClientDeps,
  type ClientContact,
  type ClientWhatsAppDeps,
} from "./notify-client";
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
const WINDOW_START_HOURS = REMINDER_WINDOW_START_HOURS;
const WINDOW_END_HOURS = REMINDER_WINDOW_END_HOURS;

/**
 * The cron's whole run is `maxDuration` (60 s, as its siblings declare). What
 * the WhatsApp reminders may spend is that, minus the time one send can take
 * (the client's 10 s timeout) and a margin, minus whatever the email reminders
 * already used. A booking is claimed before it is sent, so a run the platform
 * kills after a claim loses that reminder for good: no new send may start
 * unless it can finish inside the limit.
 */
export const CRON_MAX_MS = 60_000;
const SEND_TIMEOUT_MS = 10_000;
const MARGIN_MS = 5_000;

/** What is left for the WhatsApp reminders after `elapsedMs` of the run. */
export function reminderBudgetMs(elapsedMs: number): number {
  return Math.max(0, CRON_MAX_MS - SEND_TIMEOUT_MS - MARGIN_MS - elapsedMs);
}

const DEFAULT_BUDGET_MS = reminderBudgetMs(0);

/**
 * Meta refusing this many bookings in a row (not a timeout, not a bad
 * template: its own answer) means the next ones will be refused too, and each
 * refusal counts against the number's quality. The run stops and the bookings
 * it did not reach stay unclaimed for the next hour.
 */
const MAX_CONSECUTIVE_REFUSALS = 3;

export type ReminderRunResult = {
  sent: number;
  failed: number;
  skipped: number;
  lost: number;
  none: number;
};

type BookingRead = Parameters<typeof clientBookingOf>[0] & {
  id: string;
  /** The EMAIL reminder's stamp. Read, never written, here. */
  reminder_sent_at?: string | null;
};
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
    const deps: ClientWhatsAppDeps =
      injected ?? makeClientDeps(getAdminClient().database);
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
      .select(`id, reminder_sent_at, ${CLIENT_BOOKING_COLUMNS}`)
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

    let refusalsInARow = 0;
    const lastRefusal: { current: { error: string; code?: number } | null } = {
      current: null,
    };
    for (const booking of due) {
      if (clock() - startedAt > budgetMs) break;
      if (refusalsInARow >= MAX_CONSECUTIVE_REFUSALS) {
        console.error(
          `[whatsapp/reminders] stopped after ${MAX_CONSECUTIVE_REFUSALS} refusals in a row: ${
            lastRefusal.current?.code === undefined
              ? ""
              : `${lastRefusal.current.code}: `
          }${lastRefusal.current?.error ?? "unknown"}`,
        );
        break;
      }
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
          !reachesBack(booking.reminder_sent_at, row.updated_at) ||
          !clientRecipient(contact, facts)
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
            onRefused: (failure) => {
              lastRefusal.current = failure;
            },
          },
          deps,
        );
        // Only an outright refusal counts; anything else (a send, a skip, a
        // timeout, a lost claim) breaks the run of them.
        refusalsInARow = outcome === "refused" ? refusalsInARow + 1 : 0;
        result[outcome === "refused" ? "failed" : outcome] += 1;
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
 * Whether a booking is still in time for the WhatsApp reminder, given when its
 * EMAIL reminder went out and when the admin saved the WhatsApp row.
 *
 * Not "skip it if the email already went": in normal running the email is
 * stamped in this very pass, just before this runs, so that would silence the
 * WhatsApp reminder always. The test is the order of the two dates: a stamp at
 * or after the row's date is the ordinary pass (or the email is off, no stamp),
 * and one BEFORE it means the client had her reminder before the WhatsApp one
 * existed. The first save of the row must not send a second, late reminder to
 * everyone already reminded by email. A row with no date cannot be compared, so
 * only a booking with no email stamp goes.
 */
function reachesBack(
  emailStamp: string | null | undefined,
  rowSavedAt: string | null | undefined,
): boolean {
  if (!emailStamp) return true;
  if (!rowSavedAt) return false;
  const stamp = Date.parse(emailStamp);
  const saved = Date.parse(rowSavedAt);
  if (Number.isNaN(stamp) || Number.isNaN(saved)) return false;
  return stamp >= saved;
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
