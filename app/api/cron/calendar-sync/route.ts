import { NextResponse, type NextRequest } from "next/server";
import { syncAllCalendars } from "@/lib/calendar-sync";

/**
 * Keeps every connected calendar current, without anybody pressing anything.
 *
 * The button in Settings does the same work and stays: it is what you reach for
 * after connecting a calendar, or when you want an answer now. This is the one
 * that matters day to day — a booking taken at four in the afternoon is on the
 * professional's phone by five, and one taken while a token was expired lands
 * as soon as the token is good again.
 *
 * Repeating it is free. A booking already on a calendar is left alone, so the
 * hourly run normally finds nothing and costs one query per calendar.
 */
export const maxDuration = 60;

async function handle(request: NextRequest) {
  // Same shared secret as the reminder job: the scheduler sends it as a bearer
  // token, and without it this is an open endpoint that talks to Google.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/calendar-sync] CRON_SECRET not set — refusing to run");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await syncAllCalendars();

  // Logged rather than only returned: nobody reads a cron's response body, and
  // a calendar quietly skipped for a stale token is exactly what somebody needs
  // to know before a client turns up unannounced.
  const skipped = result.report.filter((row) => row.skipped);
  if (skipped.length > 0) {
    console.warn(
      "[cron/calendar-sync] skipped:",
      skipped.map((row) => `${row.target} (${row.skipped})`).join(", "),
    );
  }

  return NextResponse.json({ ok: true, ...result });
}

export async function POST(request: NextRequest) {
  return handle(request);
}

/** Schedulers that can only issue GET are common enough to allow it. */
export async function GET(request: NextRequest) {
  return handle(request);
}
