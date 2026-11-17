import crypto from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/insforge-admin";
import { isOptOutText, matchOptOut } from "@/lib/whatsapp/optout";
import { templateStatusFromEvent } from "@/lib/whatsapp/templates";

/**
 * Meta's callbacks: message states for the staff notifications, template
 * reviews, and inbound opt-outs.
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

type MetaInboundMessage = {
  from?: string;
  id?: string;
  type?: string;
  text?: { body?: string };
};

type MetaWebhookBody = {
  entry?: {
    changes?: {
      field?: string;
      value?: {
        statuses?: MetaStatus[];
        messages?: MetaInboundMessage[];
        // field === "message_template_status_update"
        event?: string;
        message_template_id?: string | number;
        message_template_name?: string;
        message_template_language?: string;
        reason?: string;
      };
    }[];
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

/**
 * The same order, as a number, for when two states arrive at once.
 *
 * It has to agree with `PRECEDING_STATES`: a state ranks above exactly those it
 * is allowed to move on from. `failed` sits on top because Meta reports it
 * after the fact — a message can be delivered and then found undeliverable.
 */
const STATE_RANK: Record<string, number> = {
  delivered: 1,
  read: 2,
  failed: 3,
};

/**
 * Ceiling for the contacts read when looking for the person behind a STOP.
 * `range(0, n)` is inclusive, so a full page holds n + 1 rows.
 */
const OPT_OUT_MAX_ROWS = 9_999;

/**
 * The elements of `value` that are objects, or none when it is not an array.
 *
 * The body is signed, not trusted to have the shape the types promise: a `null`
 * or a string where a list should be would otherwise throw, and a thrown error
 * is a 500 that Meta answers by retrying.
 */
function objectsIn<T>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object") as T[];
}

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

  let db: ReturnType<typeof getAdminClient>["database"];
  try {
    db = getAdminClient().database;
  } catch (err) {
    console.error("[webhooks/whatsapp] no database client:", err);
    return NextResponse.json({ received: true });
  }

  type Change = NonNullable<
    NonNullable<MetaWebhookBody["entry"]>[number]["changes"]
  >[number];
  const changes = objectsIn<{ changes?: unknown }>(
    (payload as MetaWebhookBody | null)?.entry,
  ).flatMap((entry) => objectsIn<Change>(entry.changes));

  // Everything below the signature check answers 200 whatever the database
  // does: Meta retries a non-2xx with growing backoff and ends up disabling the
  // subscription, which costs far more than one lost callback. Each block logs
  // its own failure so nothing is swallowed silently.

  // Template reviews. Meta reports here, and nowhere else, that a template we
  // submitted was approved, refused or paused.
  for (const change of changes) {
    if (change.field !== "message_template_status_update") continue;
    const value = change.value;
    try {
      const status = templateStatusFromEvent(value?.event);
      if (!status) {
        // Not written: the column only holds states the dashboard understands.
        console.warn(
          "[webhooks/whatsapp] ignored unknown template event:",
          value?.event,
        );
        continue;
      }
      const name = value?.message_template_name;
      const language = value?.message_template_language;
      if (!name || !language) continue;

      const { data: written, error } = await db
        .from("whatsapp_templates")
        .update({
          status,
          // Meta sends "NONE" when there is nothing to explain.
          rejection_reason:
            value?.reason && value.reason !== "NONE" ? value.reason : null,
          updated_at: new Date().toISOString(),
        })
        .eq("name", name)
        .eq("language", language)
        .select("id");
      if (error) throw error;
      // One line, not an error: the account may hold templates this site never
      // created, and Meta reports on all of them.
      if (!written || written.length === 0) {
        console.warn(
          `[webhooks/whatsapp] template review for an unknown template: ${name}/${language}`,
        );
      }
    } catch (err) {
      console.error(
        "[webhooks/whatsapp] could not record template review:",
        err,
      );
    }
  }

  // Opt-outs. The centre answers WhatsApp by hand, but a STOP has to be
  // honoured by the machine: it stamps the contact and every audience from now
  // on leaves them out. Only text is read, and nothing inbound is stored.
  // Everything from here to the `statuses` block must not be able to throw: a
  // STOP that blows up would cost the delivery states in the same payload.
  try {
    const optOutSenders = new Set<string>();
    for (const change of changes) {
      for (const message of objectsIn<MetaInboundMessage>(
        change.value?.messages,
      )) {
        if (message.type !== "text" || typeof message.from !== "string") {
          continue;
        }
        if (isOptOutText(message.text?.body)) optOutSenders.add(message.from);
      }
    }

    if (optOutSenders.size > 0) {
      // Phones are stored however a form wrote them, so they are compared in
      // code. Only contacts that can still be unsubscribed are read: one who
      // already opted out keeps their original date, and one who holds neither
      // consent (booking notices or marketing) has nothing to withdraw. The
      // STOP is a single opt-out that blocks both uses. At this centre's
      // volume reading them all once per payload is cheap.
      //
      // The SDK cuts a read short without saying so, which here would mean a
      // STOP silently ignored. The range is the same ceiling `audience.ts`
      // uses; hitting it is logged so it is noticed long before it matters.
      const { data, error } = await db
        .from("contacts")
        .select("id, phone")
        .or(
          "whatsapp_opted_in_at.not.is.null,whatsapp_marketing_opted_in_at.not.is.null",
        )
        .is("whatsapp_opted_out_at", null)
        .range(0, OPT_OUT_MAX_ROWS);
      if (error) throw error;

      const optedIn = (data ?? []) as { id: string; phone: string | null }[];
      if (optedIn.length > OPT_OUT_MAX_ROWS) {
        console.warn("[webhooks/whatsapp] opt-out contact list hit the cap");
      }

      const ids = matchOptOut([...optOutSenders], optedIn);
      if (ids.length > 0) {
        const { error: updateError } = await db
          .from("contacts")
          .update({ whatsapp_opted_out_at: new Date().toISOString() })
          .in("id", ids)
          // A second STOP in the same batch must not move the date.
          .is("whatsapp_opted_out_at", null);
        if (updateError) throw updateError;
      }
    }
  } catch (err) {
    console.error("[webhooks/whatsapp] could not record opt-outs:", err);
  }

  const statuses = changes.flatMap((change) =>
    objectsIn<MetaStatus>(change.value?.statuses),
  );
  if (statuses.length === 0) return NextResponse.json({ received: true });

  // One payload routinely carries both a `delivered` and a `read` for the same
  // message. Sending each on its own left the order of the writes deciding the
  // outcome, so the two had to be awaited one after another and the later one
  // still won by finishing last. Keeping only the furthest state per message
  // removes the contest: every row is written at most once, whatever arrives.
  const furthest = new Map<
    string,
    { next: string; at: string; error: string }
  >();

  for (const status of statuses) {
    const providerId = status.id;
    const next = status.status;
    if (!providerId || !next) continue;

    // `sent` we already recorded ourselves, and anything Meta adds later is
    // not a state this log knows how to show.
    if (!PRECEDING_STATES[next]) continue;

    const current = furthest.get(providerId);
    if (current && STATE_RANK[current.next]! >= STATE_RANK[next]!) continue;

    const failure = status.errors?.[0];
    furthest.set(providerId, {
      next,
      at: isoFrom(status.timestamp),
      error:
        failure?.error_data?.details ??
        failure?.message ??
        failure?.title ??
        `WhatsApp error ${failure?.code ?? "desconocido"}`,
    });
  }

  try {
    // Different messages have nothing to say to each other, so their writes go
    // out together.
    await Promise.all(
      [...furthest].map(([providerId, { next, at, error }]) =>
        db
          .from("booking_events")
          .update({
            status: next,
            ...(next === "delivered" ? { delivered_at: at } : {}),
            // Reading implies arrival, and the two callbacks are independent: a
            // `read` that overtakes its `delivered` in a later request would
            // otherwise leave the row claiming it was never delivered.
            ...(next === "read" ? { delivered_at: at, read_at: at } : {}),
            ...(next === "failed" ? { error } : {}),
          })
          .eq("provider_id", providerId)
          .in("status", PRECEDING_STATES[next]!),
      ),
    );
  } catch (err) {
    // Acknowledged all the same: Meta disables a subscription that keeps
    // erroring, and losing every future callback is worse than losing this one.
    console.error("[webhooks/whatsapp] could not record statuses:", err);
  }

  return NextResponse.json({ received: true });
}
