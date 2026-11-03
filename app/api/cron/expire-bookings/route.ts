import { NextResponse, type NextRequest } from "next/server";
import { expireUnpaidBookings } from "@/lib/bookings/run-expire-unpaid";

/**
 * Releases the slots of web bookings that were never paid.
 *
 * A web booking now exists before the client reaches the bank, so one who gives
 * up on the payment page would otherwise hold the hour until somebody noticed.
 * Meant to run every fifteen minutes; the expiry window is thirty.
 *
 * Guarded by `CRON_SECRET` like the other crons.
 */
export const maxDuration = 60;

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error(
      "[cron/expire-bookings] CRON_SECRET not set — refusing to run",
    );
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { expired } = await expireUnpaidBookings();
  if (expired.length > 0) {
    console.warn("[cron/expire-bookings] expired:", expired.join(", "));
  }
  return NextResponse.json({ ok: true, expired: expired.length });
}

export async function POST(request: NextRequest) {
  return handle(request);
}

/** Schedulers that can only issue GET are common enough to allow it. */
export async function GET(request: NextRequest) {
  return handle(request);
}
