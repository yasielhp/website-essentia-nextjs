import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/insforge-admin";
import { getAppUrl } from "@/lib/env";
import { sendEmail } from "@/emails/send";
import { bookingReminderEmail } from "@/emails/templates/booking-reminder";

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

  let sent = 0;
  let skipped = 0;

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

    // Stamped before sending: a duplicate email is worse than a missing one,
    // and a crash mid-send would otherwise resend on the next run.
    await db
      .from("bookings")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", booking.id);

    await sendEmail({
      to: booking.email,
      subject: `Tu sesión del ${formatDate(dateIso, locale)} — ${service}`,
      html: bookingReminderEmail({
        name: booking.first_name ?? "",
        service,
        sessionType: tierLabel(booking),
        date: formatDate(dateIso, locale),
        time: booking.time.slice(0, 5),
        duration: booking.duration,
        dateIso,
        cancelUrl: booking.cancel_token
          ? `${getAppUrl()}/es/reserva/cancelar?token=${booking.cancel_token}`
          : null,
        locale,
      }),
    }).catch((err) => {
      console.error("[cron/booking-reminders] send failed:", err);
    });

    sent++;
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
