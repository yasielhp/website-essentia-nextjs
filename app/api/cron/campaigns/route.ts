import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/insforge-admin";
import {
  ABANDON_AFTER_MS,
  STUCK_AFTER_MS,
  abandonedMessage,
  dispatchCampaign,
  reconcileAllInterrupted,
} from "@/lib/campaigns/dispatch";
import { runAutomation } from "@/lib/campaigns/automations";
import { deadlineFrom } from "@/lib/campaigns/deadline";
import { orderJobs, runJobs } from "@/lib/campaigns/cron-plan";
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
 * for (a scheduled campaign, an automation) waits for the next tick; the
 * appointment notices, which expire, are run before everything else
 * (`orderJobs`).
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

  // First of all, for every campaign whatever its state: rows a dead process
  // left `sending`. A one-off campaign already closed as `sent` would keep
  // them forever, because nothing resumes it.
  try {
    const touched = await reconcileAllInterrupted(now, db);
    if (touched.length > 0) results.reconciled = touched;
  } catch (err) {
    console.error("[cron/campaigns] reconcile failed:", err);
  }

  const { data: due, error: dueError } = await db
    .from("campaigns")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date(now).toISOString());
  if (dueError) {
    console.error("[cron/campaigns] query failed:", dueError);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const { data: stuck } = await db
    .from("campaigns")
    .select("id, sending_started_at, last_error")
    .eq("status", "sending")
    .lt("sending_started_at", new Date(now - STUCK_AFTER_MS).toISOString());
  const stuckRows = (stuck ?? []) as {
    id: string;
    sending_started_at: string;
    last_error: string | null;
  }[];

  // Automated campaigns: every active one is evaluated on every run. A rule
  // that owes nobody today costs one read; one that does mails them now.
  const { data: active } = await db
    .from("campaigns")
    .select("*")
    .eq("status", "active");
  const activeRows = (active ?? []) as CampaignRow[];

  const jobs = orderJobs({
    scheduled: ((due ?? []) as { id: string }[]).map((row) => row.id),
    stuck: stuckRows.map((row) => ({
      id: row.id,
      abandon:
        now - new Date(row.sending_started_at).getTime() > ABANDON_AFTER_MS,
    })),
    automations: activeRows.map((campaign) => ({
      id: campaign.id,
      kind: campaign.kind,
      event: campaign.trigger?.event,
    })),
  });

  // One at a time: each dispatch paces its own chunks, and two campaigns
  // sending at once would share Resend's rate limit rather than the clock.
  // Whatever the deadline leaves no room for waits for the next tick.
  const done = await runJobs(jobs, deadlineAt, async (job) => {
    switch (job.kind) {
      case "scheduled":
        return dispatchCampaign(job.id, { deadlineAt });
      case "resume":
        return dispatchCampaign(job.id, { resume: true, deadlineAt });
      case "abandon": {
        const row = stuckRows.find((r) => r.id === job.id);
        // Only the send this tick read: still `sending`, still unclaimed for
        // two hours. One that a retry or a resume took in between, or that
        // finished, matches nothing and is left as it is.
        const { data: abandoned, error: abandonError } = await db
          .from("campaigns")
          .update({
            status: "failed",
            last_error: abandonedMessage(row?.last_error ?? null),
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id)
          .eq("status", "sending")
          .lt(
            "sending_started_at",
            new Date(now - ABANDON_AFTER_MS).toISOString(),
          )
          .select("id");
        if (abandonError) {
          console.error(
            "[cron/campaigns] abandon failed:",
            job.id,
            abandonError,
          );
          return { abandoned: false, error: "update failed" };
        }
        return { abandoned: ((abandoned ?? []) as unknown[]).length > 0 };
      }
      case "automation": {
        const campaign = activeRows.find((c) => c.id === job.id) as CampaignRow;
        try {
          return await runAutomation(campaign, new Date(), { deadlineAt });
        } catch (err) {
          console.error("[cron/campaigns] automation failed:", job.id, err);
          return { error: (err as Error).message };
        }
      }
    }
  });
  Object.assign(results, done);

  return NextResponse.json({ ok: true, results });
}

export async function POST(request: NextRequest) {
  return handle(request);
}

/** Schedulers that can only issue GET are common enough to allow it. */
export async function GET(request: NextRequest) {
  return handle(request);
}
