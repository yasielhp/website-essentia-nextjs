import crypto from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/insforge-admin";

/**
 * Meta's status callbacks for the staff notifications.
 *
 * `sendTemplate` learns only whether the Cloud API accepted a message. What
 * happened next — delivered, read, or dropped because the number has no
 * WhatsApp — is reported here and nowhere else, so without this route a
 * notification that never reached a handset is indistinguishable from one that
 * did, and the centre finds out when a professional misses a session.
 *
 * Meta's contract, and why the replies look the way they do:
 *
 *  - `GET` is the one-off subscription handshake. It answers `hub.challenge` in
 *    plain text, and only when `hub.verify_token` matches ours.
 *  - `POST` must answer 200 quickly. Anything else, and Meta retries with
 *    growing backoff and eventually disables the subscription — so a payload we
 *    cannot use is still acknowledged, never 500-ed.
 *
 * The one thing that does *not* get a 200 is an unsigned or wrongly signed
 * body: this endpoint is public and writes to `booking_events`, so without the
 * signature check anyone could mark a lost notification as read.
 */

// `crypto.timingSafeEqual` and the raw-body read need Node, not the edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MetaStatus = {
  id?: string;
  status?: string;
  timestamp?: string;
  errors?: {
    code?: number;
    title?: string;
    message?: string;
    error_data?: { details?: string };
  }[];
};

type MetaWebhookBody = {
  entry?: {
    changes?: { value?: { statuses?: MetaStatus[] } }[];
  }[];
};

/**
 * Meta signs the exact bytes it sent. Any re-serialisation of the parsed JSON
 * changes them, which is why the handler reads `req.text()` once and parses
 * afterwards.
 */
function isSignatureValid(rawBody: string, header: string | null): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret || !header?.startsWith("sha256=")) return false;

  const expected = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");
  const received = header.slice("sha256=".length);

  // Equal length first: `timingSafeEqual` throws on a mismatch rather than
  // returning false, and the length of a digest is not a secret anyway.
  if (received.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

/**
 * Which states a row may move on from.
 *
 * Callbacks are not ordered and are redelivered on retry, so `read` regularly
 * arrives before — or without — its `delivered`. Scoping the update to the
 * states that legitimately precede the new one lets the database refuse a
 * downgrade on its own, with no read-then-write in between and no race between
 * two callbacks landing on the same row at once.
 */
const PRECEDING_STATES: Record<string, string[]> = {
  delivered: ["sent"],
  read: ["sent", "delivered"],
  failed: ["sent", "delivered", "read"],
};

/** Meta's seconds-since-epoch, as a timestamp the database will take. */
function isoFrom(timestamp: string | undefined): string {
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || seconds <= 0)
    return new Date().toISOString();
  return new Date(seconds * 1000).toISOString();
}

/** The subscription handshake. Runs once, when the webhook is first saved. */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (
    verifyToken &&
    params.get("hub.mode") === "subscribe" &&
    params.get("hub.verify_token") === verifyToken
  ) {
    // Plain text, echoed verbatim: Meta compares the body byte for byte.
    return new NextResponse(params.get("hub.challenge") ?? "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!isSignatureValid(rawBody, req.headers.get("x-hub-signature-256"))) {
    // Loud on purpose: a real callback failing this check means
    // `WHATSAPP_APP_SECRET` is missing or belongs to another app, and the
    // symptom — every notification stuck on "sent" — looks like the bug this
    // route exists to explain.
    console.error("[webhooks/whatsapp] rejected: bad or missing signature");
    return new NextResponse("Forbidden", { status: 403 });
  }

  let payload: MetaWebhookBody;
  try {
    payload = JSON.parse(rawBody) as MetaWebhookBody;
  } catch {
    return NextResponse.json({ received: true });
  }

  // Inbound messages come through this same subscription. The centre answers
  // WhatsApp by hand, so they are read past rather than stored.
  const statuses = (payload.entry ?? []).flatMap((entry) =>
    (entry.changes ?? []).flatMap((change) => change.value?.statuses ?? []),
  );
  if (statuses.length === 0) return NextResponse.json({ received: true });

  const db = getAdminClient().database;

  try {
    // One at a time rather than in parallel: a `delivered` and a `read` for the
    // same message routinely arrive in one payload, and running them together
    // would let the older of the two win by finishing last.
    for (const status of statuses) {
      const providerId = status.id;
      const next = status.status;
      if (!providerId || !next) continue;

      const from = PRECEDING_STATES[next];
      // `sent` we already recorded ourselves, and anything Meta adds later is
      // not a state this log knows how to show.
      if (!from) continue;

      const at = isoFrom(status.timestamp);
      const failure = status.errors?.[0];

      await db
        .from("booking_events")
        .update({
          status: next,
          ...(next === "delivered" ? { delivered_at: at } : {}),
          // Reading implies arrival, and the two callbacks are independent: a
          // `read` that overtakes its `delivered` would otherwise leave the row
          // claiming it was never delivered.
          ...(next === "read" ? { delivered_at: at, read_at: at } : {}),
          ...(next === "failed"
            ? {
                error:
                  failure?.error_data?.details ??
                  failure?.message ??
                  failure?.title ??
                  `WhatsApp error ${failure?.code ?? "desconocido"}`,
              }
            : {}),
        })
        .eq("provider_id", providerId)
        .in("status", from);
    }
  } catch (err) {
    // Acknowledged all the same: Meta disables a subscription that keeps
    // erroring, and losing every future callback is worse than losing this one.
    console.error("[webhooks/whatsapp] could not record statuses:", err);
  }

  return NextResponse.json({ received: true });
}
