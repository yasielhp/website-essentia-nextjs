import crypto from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/insforge-admin";
import { readAllPages } from "@/lib/campaigns/paged-read";
import {
  describeMetaFailure,
  metaFailureKind,
  type MetaFailure,
} from "@/lib/whatsapp/failure";
import { inBatches } from "@/lib/whatsapp/batch";
import { matchByPhone } from "@/lib/whatsapp/match";
import { recordOptOutSuppression } from "@/lib/whatsapp/suppression";
import { isOptOutMessage, matchOptOut } from "@/lib/whatsapp/optout";
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

type Database = ReturnType<typeof getAdminClient>["database"];

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
  /** The sender's number, digits only. May be omitted: see `senderOf`. */
  from?: string;
  /** Meta's own id for the sender, when it names one. Not used yet. */
  from_user_id?: string;
  id?: string;
  type?: string;
  /** `type: "text"`: what the client typed. */
  text?: { body?: string };
  /** `type: "button"`: a quick-reply button of a template. */
  button?: { text?: string; payload?: string };
  /** `type: "interactive"`: a reply button or a list row. */
  interactive?: {
    type?: string;
    button_reply?: { id?: string; title?: string };
    list_reply?: { id?: string; title?: string };
  };
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

  // Equal size first: `timingSafeEqual` throws on a mismatch rather than
  // returning false, and the size of a digest is not a secret anyway. It is
  // the BYTES that must match in number, not the characters: a header with a
  // non-ASCII character has as many characters as a digest and more bytes.
  const receivedBytes = Buffer.from(received, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  if (receivedBytes.byteLength !== expectedBytes.byteLength) return false;
  return crypto.timingSafeEqual(receivedBytes, expectedBytes);
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

/** Messages whose receipts are written at the same time. */
const STATUS_BATCH_SIZE = 10;

/** What is read of a contact to match it against an inbound number. */
type InboundContact = { id: string; phone: string | null };

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

/**
 * The number an inbound message came from, or null when it carries none.
 *
 * Meta's reference says `from` (and `wa_id`) MAY BE OMITTED, with the sender
 * named only by `from_user_id`, an id of Meta's own that is not a phone.
 * Everything this route does with an inbound message is keyed by the number,
 * so a message without one has nobody to be applied to. A `from` that is not a
 * string, or has no digit in it, is the same case.
 */
function senderOf(message: MetaInboundMessage): string | null {
  const from: unknown = message.from;
  return typeof from === "string" && /\d/.test(from) ? from : null;
}

/** Meta's seconds-since-epoch, as a timestamp the database will take. */
function isoFrom(timestamp: string | undefined): string {
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || seconds <= 0)
    return new Date().toISOString();
  return new Date(seconds * 1000).toISOString();
}

/**
 * Moves a campaign recipient forward when `providerId` is one of theirs.
 *
 * `record_campaign_event` does the ranking and the counters, and maps `read` to
 * "opened" and `failed` to "bounced" for WhatsApp campaigns on its own, so the
 * events go in exactly as Meta names them. True means the message belonged to a
 * campaign and moved; false means unknown, repeated or not an advance.
 *
 * A failure that says the number cannot receive WhatsApp at all also stamps the
 * contact, so no campaign tries it again. Limits and anything unrecognised do
 * not: the number may be fine. The stamp can fail without taking the receipt
 * with it, which is why it has its own try/catch.
 *
 * Known risk, inherited from the email side: Meta can report `failed` after
 * `delivered` or `read`. The recipient then goes from `opened` to `bounced`,
 * and the RPC does not take the message back out of `delivered_count` or
 * `opened_count`, so that campaign can show it both delivered and bounced.
 */
async function recordCampaignReceipt(
  db: Database,
  providerId: string,
  { next, at, failure }: { next: string; at: string; failure?: MetaFailure },
): Promise<boolean> {
  const { data: moved, error } = await db.rpc("record_campaign_event", {
    p_provider_id: providerId,
    p_event: next,
    p_at: at,
    p_error: next === "failed" ? describeMetaFailure(failure) : null,
  });
  if (error) throw error;
  if (moved !== true) return false;

  if (next === "failed" && metaFailureKind(failure?.code) === "unreachable") {
    try {
      const { data: row, error: readError } = await db
        .from("campaign_recipients")
        .select("contact_id")
        .eq("provider_id", providerId)
        .maybeSingle();
      if (readError) throw readError;
      const contactId = (row as { contact_id: string | null } | null)
        ?.contact_id;
      if (contactId) {
        const { error: stampError } = await db
          .from("contacts")
          .update({ whatsapp_unreachable_at: new Date().toISOString() })
          .eq("id", contactId)
          // The first time is the one worth keeping.
          .is("whatsapp_unreachable_at", null);
        if (stampError) throw stampError;
      }
    } catch (err) {
      console.error("[webhooks/whatsapp] could not flag unreachable:", err);
    }
  }
  return true;
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

  let db: Database;
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
  // on leaves them out. The word can be typed or pressed (a template's
  // quick-reply button, an interactive reply): `isOptOutMessage` reads each of
  // those and nothing else, and nothing inbound is stored.
  // Everything from here to the `statuses` block must not be able to throw: a
  // STOP that blows up would cost the delivery states in the same payload.
  try {
    const optOutSenders = new Set<string>();
    // Messages that name no number: see `senderOf`. Counted, never applied.
    const unnamed: { id: string; optOut: boolean }[] = [];
    for (const change of changes) {
      for (const message of objectsIn<MetaInboundMessage>(
        change.value?.messages,
      )) {
        const sender = senderOf(message);
        const optOut = isOptOutMessage(message);
        if (sender === null) {
          unnamed.push({
            id: typeof message.id === "string" ? message.id : "?",
            optOut,
          });
        } else if (optOut) {
          optOutSenders.add(sender);
        }
      }
    }

    // Said out loud, once per payload: a STOP that arrives without a number
    // CANNOT be honoured (the contact, the STOP list and the unreachable mark
    // are all found by number), and silence here would be an opt-out ignored
    // with nobody knowing. The message ids are Meta's; the person's own id is
    // deliberately not logged. The fix is to keep Meta's user id per send; see
    // `docs/plans/2026-11-17-whatsapp-findings.md`.
    if (unnamed.length > 0) {
      const lost = unnamed.filter((m) => m.optOut);
      const ids = (list: typeof unnamed) => list.map((m) => m.id).join(", ");
      console.warn(
        lost.length > 0
          ? `[webhooks/whatsapp] ${lost.length} opt-out(s) arrived with no sender number and could NOT be applied (${ids(lost)}); ${unnamed.length} inbound message(s) without a number in all`
          : `[webhooks/whatsapp] ${unnamed.length} inbound message(s) arrived with no sender number and were not matched to anyone (${ids(unnamed)})`,
      );
    }

    if (optOutSenders.size > 0) {
      // The NUMBER is remembered first and whether or not any contact matches
      // it: the opt-out below is per contact, and a number that a stranger put
      // on someone else's booking has no contact of its own to withdraw. A
      // failure here (the table is created by a migration) is logged and does
      // not stop the contacts' opt-out or the delivery states.
      await recordOptOutSuppression(db, [...optOutSenders]);

      // Phones are stored however a form wrote them, so they are compared in
      // code. Only contacts that can still be unsubscribed are read: one who
      // already opted out keeps their original date, and one who holds neither
      // consent (booking notices or marketing) has nothing to withdraw. The
      // STOP is a single opt-out that blocks both uses. At this centre's
      // volume reading them all once per payload is cheap.
      //
      // The database answers at most a thousand rows a request, whatever
      // range is asked for, which here meant a STOP silently ignored for the
      // contact in position 1001. So they are read a page at a time, in the
      // order of their id; a page that fails fails the whole read (caught
      // below, like any other failure here), and nobody is opted out on part
      // of the list.
      const optedIn = await readAllPages<InboundContact>(
        "[webhooks/whatsapp] opt-out contacts",
        (from, to) =>
          db
            .from("contacts")
            .select("id, phone")
            .or(
              "whatsapp_opted_in_at.not.is.null,whatsapp_marketing_opted_in_at.not.is.null",
            )
            .is("whatsapp_opted_out_at", null)
            .order("id", { ascending: true })
            .range(from, to),
      );

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

  // Anyone who writes to us has WhatsApp, so a number flagged as unreachable
  // (131026 covers causes that pass) is cleared the moment it sends anything,
  // whatever the type. A STOP clears it too, which is harmless: the opt-out
  // stamped above is what keeps that contact out of campaigns.
  try {
    const inboundSenders = new Set<string>();
    for (const change of changes) {
      for (const message of objectsIn<MetaInboundMessage>(
        change.value?.messages,
      )) {
        const sender = senderOf(message);
        if (sender !== null) inboundSenders.add(sender);
      }
    }

    if (inboundSenders.size > 0) {
      // Only the flagged contacts are read, once per payload and only when
      // something came in; there are few of them. A page at a time all the
      // same, for the reason given at the opt-outs above.
      const flagged = await readAllPages<InboundContact>(
        "[webhooks/whatsapp] unreachable contacts",
        (from, to) =>
          db
            .from("contacts")
            .select("id, phone")
            .not("whatsapp_unreachable_at", "is", null)
            .order("id", { ascending: true })
            .range(from, to),
      );

      const ids = matchByPhone([...inboundSenders], flagged);
      if (ids.length > 0) {
        const { error: clearError } = await db
          .from("contacts")
          .update({ whatsapp_unreachable_at: null })
          .in("id", ids);
        if (clearError) throw clearError;
      }
    }
  } catch (err) {
    console.error("[webhooks/whatsapp] could not clear unreachable:", err);
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
    { next: string; at: string; error: string; failure?: MetaFailure }
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
      failure,
    });
  }

  // Different messages have nothing to say to each other, so their writes go
  // out together, but a payload can carry hundreds of them: ten at a time keeps
  // the requests in flight bounded. A run that fails is logged and the next one
  // still goes.
  for (const run of inBatches([...furthest], STATUS_BATCH_SIZE)) {
    try {
      await Promise.all(
        run.map(async ([providerId, { next, at, error, failure }]) => {
          // A message sent by a campaign has its receipt in `campaign_recipients`
          // and no row in `booking_events`. Ask the campaigns first; when it was
          // not one of theirs (or nothing moved), the staff log below is a no-op
          // or the update it always was.
          try {
            if (
              typeof providerId === "string" &&
              (await recordCampaignReceipt(db, providerId, {
                next,
                at,
                failure,
              }))
            ) {
              return;
            }
          } catch (err) {
            console.error(
              "[webhooks/whatsapp] could not record campaign receipt:",
              err,
            );
          }

          // The SDK answers `{ error }` instead of throwing, so the error has
          // to be read here: unread, a state the database refused vanished
          // without a line. Caught per message, so one refusal does not cost
          // the others of the run.
          try {
            // Reading implies arrival, and the two callbacks are independent:
            // a `read` that overtakes its `delivered` in a later request would
            // otherwise leave the row claiming it was never delivered. So a
            // read FILLS the hour of delivery, and only where there is none:
            // written with the state, it replaced the real hour of a delivery
            // already stamped with the hour of the reading. PostgREST has no
            // COALESCE in an update, hence a write of its own, and first, so
            // a row is never left read and not delivered.
            let fillError: unknown = null;
            if (next === "read") {
              ({ error: fillError } = await db
                .from("booking_events")
                .update({ delivered_at: at })
                .eq("provider_id", providerId)
                .in("status", PRECEDING_STATES[next]!)
                .is("delivered_at", null));
            }

            const { error: writeError } = await db
              .from("booking_events")
              .update({
                status: next,
                ...(next === "delivered" ? { delivered_at: at } : {}),
                ...(next === "read" ? { read_at: at } : {}),
                ...(next === "failed" ? { error } : {}),
              })
              .eq("provider_id", providerId)
              .in("status", PRECEDING_STATES[next]!);
            // The state was tried whatever the fill did; either failure is one.
            if (writeError ?? fillError) throw writeError ?? fillError;
          } catch (err) {
            console.error(
              `[webhooks/whatsapp] could not record status ${next} of ${providerId}:`,
              err,
            );
          }
        }),
      );
    } catch (err) {
      console.error("[webhooks/whatsapp] could not record statuses:", err);
    }
  }

  // Acknowledged even when a write above failed, and on purpose. A non-200
  // makes Meta send the WHOLE payload again, with decreasing frequency for up
  // to 7 days, and a payload is not only states: it can carry a STOP or a
  // template review next to them, and a review written again after a newer
  // one puts the template back in an old state. The states alone could be
  // repeated safely (`record_campaign_event` and the scoped update only move
  // forward), so a 503 for a payload that holds nothing but states is the
  // next step if a lost receipt ever costs more than it does today. Until
  // then the failure is logged above, per message, with the id to look it up.

  return NextResponse.json({ received: true });
}
