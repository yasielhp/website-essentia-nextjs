import { NextResponse, type NextRequest } from "next/server";
import { syncTemplatesFromMeta } from "@/lib/whatsapp/sync-templates";

/**
 * POST/GET /api/cron/whatsapp-templates
 *
 * Brings the account's WhatsApp templates from Meta into the dashboard's copy.
 *
 * Meta tells the webhook when it approves, rejects or pauses a template, and
 * the templates page asks again when it is opened; this is for what both miss:
 * a callback that never arrived on a day nobody opened the page, and a template
 * made in Meta's own manager. A campaign refuses a template that is no longer
 * approved, so the copy has to be right even when nobody is looking.
 *
 * Meant to run every hour. It only reads Meta and writes the copy. With no
 * WhatsApp Business account configured there is nothing to ask and that is not
 * an error. Guarded by `CRON_SECRET` like the other crons.
 */
export const maxDuration = 30;

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error(
      "[cron/whatsapp-templates] CRON_SECRET not set — refusing to run",
    );
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await syncTemplatesFromMeta();
  if (result.ok) {
    return NextResponse.json({
      ok: true,
      synced: result.count,
      skipped: result.skipped,
    });
  }
  if (result.error === "whatsapp_not_configured") {
    return NextResponse.json({ ok: true, skipped: "not_configured" });
  }
  // Said in the log and in the answer; the detail (what Meta answered) stays
  // in the log.
  console.error(
    "[cron/whatsapp-templates] sync failed:",
    result.error,
    result.detail ?? "",
  );
  return NextResponse.json({ error: result.error }, { status: 500 });
}

export async function POST(request: NextRequest) {
  return handle(request);
}

/** Schedulers that can only issue GET are common enough to allow it. */
export async function GET(request: NextRequest) {
  return handle(request);
}
