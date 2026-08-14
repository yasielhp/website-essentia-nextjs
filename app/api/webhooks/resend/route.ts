import { type NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getAdminClient } from "@/lib/insforge-admin";

/**
 * Resend's delivery callbacks for the booking emails.
 *
 * `sent` only ever meant that Resend accepted the message — the same half-truth
 * `sent` told about WhatsApp before Meta's webhook existed. What happened next,
 * whether the client's inbox took it or the address bounced, is reported here
 * and nowhere else, and it applies to both emails a booking produces: the one to
 * the client and the one to the professional.
 *
 * The row is found by `provider_id`, the id Resend returned when the message
 * went out, which `sendEmail` now carries back to the history.
 *
 * As with Meta, a body that is unsigned or signed with another secret gets a
 * 403 and nothing else: this is a public URL that writes to `booking_events`,
 * and without the check anyone could mark an email as read by the client.
 */

// The SDK's verifier and the raw-body read both need Node, not the edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ResendEvent = {
  type?: string;
  created_at?: string;
  data?: { email_id?: string; bounce?: { message?: string } };
};

/**
 * How far an event moves the row along.
 *
 * `opened` maps to `read` because the history has one vocabulary across
 * channels — but see the note in the dashboard: an open is a pixel being
 * fetched, and Apple Mail fetches it for everybody whether they read the
 * message or not. Delivery is the fact; an open is a hint.
 */
const NEXT_STATUS: Record<string, "delivered" | "read" | "failed"> = {
  "email.delivered": "delivered",
  "email.opened": "read",
  "email.bounced": "failed",
  "email.complained": "failed",
};

/**
 * Which states a row may move on from.
 *
 * Callbacks arrive out of order and are redelivered on retry, exactly as
 * Meta's do. Scoping the update to the states that legitimately precede the new
 * one lets the database refuse a downgrade on its own, with no read-then-write
 * in between.
 */
const PRECEDING_STATES: Record<string, string[]> = {
  delivered: ["sent"],
  read: ["sent", "delivered"],
  failed: ["sent", "delivered", "read"],
};

/** What went wrong, in Resend's own words where it gives them. */
function reasonFor(event: ResendEvent): string {
  const bounce = event.data?.bounce?.message;
  if (bounce) return bounce;
  return event.type === "email.complained"
    ? "El destinatario lo marcó como spam"
    : "Rebotado";
}

export async function POST(req: NextRequest) {
  // Resend signs the exact bytes it sent, so the body is read as text and
  // parsed only after the signature has been checked.
  const rawBody = await req.text();

  const id = req.headers.get("svix-id");
  const timestamp = req.headers.get("svix-timestamp");
  const signature = req.headers.get("svix-signature");
  const secret = process.env.RESEND_WEBHOOK_SECRET;

  if (!secret || !id || !timestamp || !signature) {
    // Loud on purpose: a real callback failing this means the secret never
    // reached the deployment, and the symptom — every email stuck on "sent" —
    // looks exactly like the problem this route exists to solve.
    console.error("[webhooks/resend] rejected: missing secret or headers");
    return new NextResponse("Forbidden", { status: 403 });
  }

  let event: ResendEvent;
  try {
    event = new Resend(process.env.RESEND_API_KEY).webhooks.verify({
      payload: rawBody,
      headers: { id, timestamp, signature },
      webhookSecret: secret,
    }) as ResendEvent;
  } catch (err) {
    console.error("[webhooks/resend] rejected: bad signature", err);
    return new NextResponse("Forbidden", { status: 403 });
  }

  const emailId = event.data?.email_id;
  const next = event.type ? NEXT_STATUS[event.type] : undefined;
  // `email.sent` and `email.delivery_delayed` come through the same
  // subscription and say nothing this log does not already know.
  if (!emailId || !next) return NextResponse.json({ received: true });

  const at = event.created_at ?? new Date().toISOString();

  try {
    await getAdminClient()
      .database.from("booking_events")
      .update({
        status: next,
        ...(next === "delivered" ? { delivered_at: at } : {}),
        // An open implies arrival, and the two callbacks are independent: an
        // open that overtakes its delivery would otherwise leave the row
        // claiming the message never got there.
        ...(next === "read" ? { delivered_at: at, read_at: at } : {}),
        ...(next === "failed" ? { error: reasonFor(event) } : {}),
      })
      .eq("provider_id", emailId)
      .eq("channel", "email")
      .in("status", PRECEDING_STATES[next]!);
  } catch (err) {
    // Acknowledged all the same: Resend retries, and a webhook that keeps
    // erroring is a webhook that ends up disabled.
    console.error("[webhooks/resend] could not record status:", err);
  }

  return NextResponse.json({ received: true });
}
