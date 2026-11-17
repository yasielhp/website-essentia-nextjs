import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/insforge-admin";
import { getAppUrl } from "@/lib/env";
import { sendEmailBatch } from "@/emails/send";
import { bookingReminderEmail } from "@/emails/templates/booking-reminder";
import { fixedBlocksHtml } from "@/lib/messages/fixed-blocks";
import { loadMessageRow, renderMessageEmail } from "@/lib/messages/render";
import { pruneAuthEvents } from "@/lib/auth-security";

/**
 * POST/GET /api/cron/booking-reminders
 *
 * Emails everyone whose session is roughly two days away, once each.
 *
 * Two days is deliberate: the free-cancellation window closes 24 hours before,
 * so the reminder has to land while cancelling is still free. A slot freed two
 * days out can be sold again; a no-show cannot.
 *
 * Meant to be called by a scheduler every hour. Guarded by `CRON_SECRET`
 * because it reads client data in bulk and sends mail — anyone able to call it
 * repeatedly could flood a client's inbox, so the stamp on the row is both a
 * de-duplicator and a rate limit.
 */
const WINDOW_START_HOURS = 40;
const WINDOW_END_HOURS = 56;

type Row = {
  id: string;
  email: string | null;
  first_name: string | null;
  service_title: string | null;
  date: string | null;
  time: string | null;
  duration: string | null;
  cancel_token: string | null;
  // The SDK types an embedded relation as an array even when it is one row.
  service_tiers: { label: string | null }[] | { label: string | null } | null;
};

const tierLabel = (row: Row): string | null =>
  Array.isArray(row.service_tiers)
    ? (row.service_tiers[0]?.label ?? null)
    : (row.service_tiers?.label ?? null);

function formatDate(dateIso: string, locale: "en" | "es"): string {
  const [y, m, d] = dateIso.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString(
    locale === "es" ? "es-ES" : "en-GB",
    { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  );
}

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 500 });
  }

  const provided =
    request.headers.get("authorization")?.replace(/^Bearer /, "") ??
    new URL(request.url).searchParams.get("secret");
  if (provided !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = getAdminClient().database;
  const now = Date.now();

  // Rides along rather than on a schedule of its own: the login trail needs
  // sweeping roughly daily and this already runs every hour, so a second cron
  // entry, a second secret and a second thing to forget buys nothing.
  await pruneAuthEvents();

  const dayOf = (hours: number) =>
    new Date(now + hours * 3_600_000).toISOString().slice(0, 10);

  // A date range first, so the query stays indexable; the exact hour is
  // checked below, where the booking's own time is known.
  const { data, error } = await db
    .from("bookings")
    .select(
      "id, email, first_name, service_title, date, time, duration, cancel_token, service_tiers(label)",
    )
    .in("status", ["confirmed", "paid"])
    .gte("date", dayOf(WINDOW_START_HOURS))
    .lte("date", dayOf(WINDOW_END_HOURS))
    .is("reminder_sent_at", null);

  if (error) {
    console.error("[cron/booking-reminders] query failed:", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  let skipped = 0;
  const due: {
    id: string;
    email: Parameters<typeof sendEmailBatch>[0][number];
  }[] = [];

  // The saved reminder, read once for the whole run: every booking in it gets
  // the same message. A failed read is the same as no saved reminder.
  const savedReminder =
    (data ?? []).length === 0
      ? null
      : await loadMessageRow("booking_reminder", "es").catch((err) => {
          console.error(
            "[cron/booking-reminders] could not read the message:",
            err,
          );
          return null;
        });
  let switchedOff = 0;

  // The loop only decides who is due and writes their email; nothing is sent
  // or stamped inside it, so there is no request waiting on the one before.
  for (const booking of (data ?? []) as Row[]) {
    if (!booking.email || !booking.date || !booking.time) {
      skipped++;
      continue;
    }

    const startsInHours =
      (new Date(`${booking.date.slice(0, 10)}T${booking.time}:00`).getTime() -
        now) /
      3_600_000;
    if (
      startsInHours < WINDOW_START_HOURS ||
      startsInHours > WINDOW_END_HOURS
    ) {
      skipped++;
      continue;
    }

    // The site is bilingual and the booking does not record which language the
    // client used, so Spanish is the house default here.
    const locale: "en" | "es" = "es";
    const dateIso = booking.date.slice(0, 10);
    const service = booking.service_title ?? "Essentia";

    const date = formatDate(dateIso, locale);
    const time = booking.time.slice(0, 5);
    const sessionType = tierLabel(booking);
    const cancelUrl = booking.cancel_token
      ? `${getAppUrl()}/es/reserva/cancelar?token=${booking.cancel_token}`
      : null;

    // The admin's version of the reminder, if they edited or switched it off;
    // otherwise (or if reading it fails) `legacy` and the email goes out as it
    // always has.
    const custom = await renderMessageEmail(
      {
        key: "booking_reminder",
        locale,
        vars: {
          first_name: booking.first_name ?? "",
          service,
          session_type: sessionType ?? "",
          date,
          time,
          duration: booking.duration ?? "",
          cancel_url: cancelUrl ?? "",
        },
        fixedHtml: () =>
          fixedBlocksHtml("booking_reminder", {
            locale,
            service,
            sessionType,
            date,
            time,
            duration: booking.duration,
            dateIso,
            cancelUrl,
          }),
      },
      async () => savedReminder,
    );

    // Switched off: nothing is sent and the booking is not stamped, so turning
    // the reminder back on still reaches whoever is inside the window then.
    // The booking history has no entry for reminders today, so the omission is
    // logged once, after the loop.
    if (custom.kind === "skip") {
      switchedOff++;
      skipped++;
      continue;
    }

    due.push({
      id: booking.id,
      email: {
        to: booking.email,
        subject:
          custom.kind === "custom"
            ? custom.subject
            : `Tu sesión del ${date} — ${service}`,
        html:
          custom.kind === "custom"
            ? custom.html
            : bookingReminderEmail({
                name: booking.first_name ?? "",
                service,
                sessionType,
                date,
                time,
                duration: booking.duration,
                dateIso,
                cancelUrl,
                locale,
              }),
      },
    });
  }

  if (switchedOff > 0) {
    console.info(
      `[cron/booking-reminders] reminder switched off: ${switchedOff} not sent`,
    );
  }

  if (due.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, skipped });
  }

  // Nothing to send with: nothing is stamped either. A stamp here would be the
  // end of these reminders (`sendEmailBatch` shrugs without a key), and with
  // none they are still owed to the next run that has one.
  if (!process.env.RESEND_API_KEY) {
    console.error(
      `[cron/booking-reminders] RESEND_API_KEY not set: ${due.length} reminders not sent, not stamped`,
    );
    return NextResponse.json(
      { error: "RESEND_API_KEY not set" },
      { status: 500 },
    );
  }

  // Stamped before sending, all of them at once: a duplicate reminder is worse
  // than a missing one, and a crash between here and the send would otherwise
  // send the lot again on the next run.
  //
  // For the same reason the stamp has to be seen to land. If it fails nobody
  // is mailed: a booking mailed without its stamp would be mailed again every
  // hour it spends in the window (sixteen of them), while one left unstamped
  // and unmailed gets its reminder from the next run. And only the bookings
  // the stamp took are mailed (it takes one nobody has stamped yet), so two
  // runs that overlap cannot both send.
  const { data: stampedRows, error: stampError } = await db
    .from("bookings")
    .update({ reminder_sent_at: new Date().toISOString() })
    .in(
      "id",
      due.map((item) => item.id),
    )
    .is("reminder_sent_at", null)
    .select("id");

  if (stampError) {
    console.error(
      "[cron/booking-reminders] stamp failed, nothing sent:",
      stampError,
    );
    return NextResponse.json({ error: "Stamp failed" }, { status: 500 });
  }

  const stamped = new Set(
    ((stampedRows ?? []) as { id: string }[]).map((row) => row.id),
  );
  const toSend = due.filter((item) => stamped.has(item.id));
  skipped += due.length - toSend.length;
  if (toSend.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, skipped });
  }

  // One request for the whole run, which is what keeps this off Resend's rate
  // limit — the reason the loop above used to be sequential.
  const {
    sent,
    ids,
    error: sendError,
  } = await sendEmailBatch(toSend.map((item) => item.email));

  // A send that failed after the stamp. `sendEmailBatch` hands back one text
  // for a refusal by Resend and for a request that never got an answer, so
  // which of the two it was is not known here, and an email with no id may
  // still have left. The stamp is therefore kept (a duplicate is worse than a
  // missing reminder), but the loss is not a quiet one: the bookings are named
  // in the log and the run answers a 500.
  if (sendError) {
    const unsent = toSend.filter((_, index) => !ids[index]).map((b) => b.id);
    console.error(
      "[cron/booking-reminders] batch failed:",
      sendError,
      "- stamped but not confirmed sent:",
      unsent.join(", "),
    );
    return NextResponse.json(
      { error: "Send failed", sent, skipped, unsent },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, sent, skipped });
}

export async function POST(request: NextRequest) {
  return handle(request);
}

/** Schedulers that can only issue GET are common enough to allow it. */
export async function GET(request: NextRequest) {
  return handle(request);
}
