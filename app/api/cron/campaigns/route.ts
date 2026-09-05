import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/insforge-admin";
import {
  ABANDON_AFTER_MS,
  STUCK_AFTER_MS,
  dispatchCampaign,
} from "@/lib/campaigns/dispatch";

/**
 * POST/GET /api/cron/campaigns
 *
 * Sends the campaigns whose time has come, and finishes the ones a previous
 * run left half-done.
 *
 * Meant to run every fifteen minutes. A scheduled campaign resolves its
 * audience here, not when it was scheduled, so a client who signed up this
 * morning is on this afternoon's send. A campaign stuck in `sending` for
 * longer than the stuck window is resumed — only its `queued` rows go out — and
 * one stuck for hours is given up on and marked failed, so the list never
 * shows "sending" forever.
 *
 * Guarded by `CRON_SECRET` like the other crons: this reads client data in
 * bulk and sends mail.
 */

// Fifty chunks of a hundred, paced at two a second, is around half a minute.
export const maxDuration = 60;

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
  const results: Record<string, unknown> = {};

  const { data: due, error: dueError } = await db
    .from("campaigns")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date(now).toISOString());
  if (dueError) {
    console.error("[cron/campaigns] query failed:", dueError);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  // One at a time: each dispatch paces its own chunks, and two campaigns
  // sending at once would share Resend's rate limit rather than the clock.
  for (const row of (due ?? []) as { id: string }[]) {
    results[row.id] = await dispatchCampaign(row.id);
  }

  const { data: stuck } = await db
    .from("campaigns")
    .select("id, sending_started_at")
    .eq("status", "sending")
    .lt("sending_started_at", new Date(now - STUCK_AFTER_MS).toISOString());

  for (const row of (stuck ?? []) as {
    id: string;
    sending_started_at: string;
  }[]) {
    const age = now - new Date(row.sending_started_at).getTime();
    if (age > ABANDON_AFTER_MS) {
      await db
        .from("campaigns")
        .update({
          status: "failed",
          last_error: "abandoned after two hours in sending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      results[row.id] = { abandoned: true };
    } else {
      results[row.id] = await dispatchCampaign(row.id, { resume: true });
    }
  }

  return NextResponse.json({ ok: true, results });
}

export async function POST(request: NextRequest) {
  return handle(request);
}

/** Schedulers that can only issue GET are common enough to allow it. */
export async function GET(request: NextRequest) {
  return handle(request);
}
