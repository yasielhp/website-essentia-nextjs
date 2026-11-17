import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/insforge-admin";
import {
  ABANDON_AFTER_MS,
  STUCK_AFTER_MS,
  abandonedMessage,
  dispatchCampaign,
} from "@/lib/campaigns/dispatch";
import { runAutomation } from "@/lib/campaigns/automations";
import { deadlineFrom, outOfTime } from "@/lib/campaigns/deadline";
import type { CampaignRow } from "@/types/campaign";

/**
 * POST/GET /api/cron/campaigns
 *
 * Sends the campaigns whose time has come, finishes the ones a previous run
 * left half-done, and gives every active automation its turn.
 *
 * Meant to run every fifteen minutes. A scheduled campaign resolves its
 * audience here, not when it was scheduled, so a client who signed up this
 * morning is on this afternoon's send. A campaign stuck in `sending` for
 * longer than the stuck window is resumed — only its `queued` rows go out — and
 * one that nobody has claimed for two hours is given up on and marked failed,
 * so the list never shows "sending" forever.
 *
 * A WhatsApp campaign too big for one tick stops at the shared deadline and
 * stays `sending` with its rest queued: that is how it ends up here as "stuck"
 * and is resumed by the next tick. Each resume re-stamps the claim, so a long
 * campaign making progress is not abandoned. Work the deadline leaves no room
 * for (a scheduled campaign, an automation) waits for the next tick.
 *
 * Guarded by `CRON_SECRET` like the other crons: this reads client data in
 * bulk and sends mail.
 */

// One tick does all of its work inside this. Email goes out in chunks of a
// hundred paced at two a second; WhatsApp at ten a second. Everything WhatsApp
// shares one deadline (`deadlineFrom`, 50 s), so two campaigns in a tick cannot
// push the function past the 60 s it is allowed: what does not fit stays
// queued and the next tick finishes it.
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
  const deadlineAt = deadlineFrom(now);
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
    // Out of time: it stays `scheduled` and the next tick takes it.
    if (outOfTime(deadlineAt)) {
      results[row.id] = { deferred: "out of time" };
      continue;
    }
    results[row.id] = await dispatchCampaign(row.id, { deadlineAt });
  }

  const { data: stuck } = await db
    .from("campaigns")
    .select("id, sending_started_at, last_error")
    .eq("status", "sending")
    .lt("sending_started_at", new Date(now - STUCK_AFTER_MS).toISOString());

  for (const row of (stuck ?? []) as {
    id: string;
    sending_started_at: string;
    last_error: string | null;
  }[]) {
    const age = now - new Date(row.sending_started_at).getTime();
    if (age > ABANDON_AFTER_MS) {
      await db
        .from("campaigns")
        .update({
          status: "failed",
          last_error: abandonedMessage(row.last_error),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      results[row.id] = { abandoned: true };
    } else if (outOfTime(deadlineAt)) {
      results[row.id] = { deferred: "out of time" };
    } else {
      results[row.id] = await dispatchCampaign(row.id, {
        resume: true,
        deadlineAt,
      });
    }
  }

  // Automated campaigns: every active one is evaluated on every run. A rule
  // that owes nobody today costs one read; one that does mails them now.
  const { data: active } = await db
    .from("campaigns")
    .select("*")
    .eq("status", "active");
  for (const campaign of (active ?? []) as CampaignRow[]) {
    if (outOfTime(deadlineAt)) {
      results[campaign.id] = { deferred: "out of time" };
      continue;
    }
    try {
      results[campaign.id] = await runAutomation(campaign, new Date(), {
        deadlineAt,
      });
    } catch (err) {
      console.error("[cron/campaigns] automation failed:", campaign.id, err);
      results[campaign.id] = { error: (err as Error).message };
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
