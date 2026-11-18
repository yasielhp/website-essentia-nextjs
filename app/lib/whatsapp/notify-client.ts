import { recordBookingEvent } from "@/lib/booking-events/record";
import type {
  BookingEventActorRole,
  BookingEventInput,
} from "@/lib/booking-events/types";
import { getAdminClient } from "@/lib/insforge-admin";
import { MESSAGE_CATALOG, type MessageKey } from "@/lib/messages/catalog";
import { OFF_REASON, whatsappOffSummary } from "@/lib/messages/off-note";
import type { CampaignLocale } from "@/types/campaign";
import {
  isWhatsAppConfigured,
  sendTemplateMessage,
  type TemplateSend,
} from "./client";
import {
  bookingLocale,
  clientRecipient,
  decideClientWhatsApp,
  type ClientBooking,
  type ClientContact,
  type ClientMessageRow,
  type ClientSkipReason,
  type ClientWhatsAppEvent,
} from "./client-decision";
import { isPhoneSuppressed } from "./suppression";
import type { WhatsAppSendResult, WhatsAppTemplateRow } from "./types";

/**
 * WhatsApp to the CLIENT about her own booking: the confirmation, the paid
 * confirmation and the reminder, on the template the admin chose for each.
 *
 * These are transactional notices, so what lets one go is the booking-notice
 * consent (`whatsapp_opted_in_at`, recorded when she accepts the Terms and the
 * Privacy Policy on the public booking form, whose line says the confirmation
 * and the reminder of her appointment go by email and WhatsApp), never the
 * marketing one. A booking the team makes from the dashboard records none. Nothing is
 * sent unless ALL of these hold, and when one does not, nothing is written
 * either (a history row for every booking without consent would bury the real
 * ones):
 *
 *  - the message is one the opt-in promises (`whatsappEligible` in the
 *    catalogue);
 *  - a saved `message_templates` row for that message, channel `whatsapp` and
 *    the booking's language names a template;
 *  - the client has the consent, has not opted out, is not marked unreachable,
 *    and has a number the database would accept.
 *
 * Only then is the template itself judged. A template that cannot be sent
 * (not approved, wrong language, parameters that do not add up) is a
 * misconfiguration the admin has to see, so it leaves ONE `skipped` entry in
 * the booking's history with the reason.
 *
 * Pure decision first, effects after, both with their dependencies handed in,
 * as in `dispatch-whatsapp.ts`. SERVER ONLY and not a Server Action: it
 * carries no role check and writes the history.
 */

// The decision half lives in `client-decision.ts`; everything is re-exported
// from here so callers and tests keep one import.
export * from "./client-decision";

// ── effects ────────────────────────────────────────────────────────────────

type Db = ReturnType<typeof getAdminClient>["database"];

export type ClientWhatsAppDeps = {
  db: Db;
  send: (send: TemplateSend) => Promise<WhatsAppSendResult>;
  record: (entry: BookingEventInput) => Promise<void>;
  isConfigured: () => boolean;
  /**
   * Whether a number is on the STOP list. Throws when the list cannot be read
   * (the table may not exist yet); the caller treats that as "yes".
   */
  isSuppressed: (phone: string) => Promise<boolean>;
};

/** The real dependencies, over one database client. */
export function makeClientDeps(db: Db): ClientWhatsAppDeps {
  return {
    db,
    send: sendTemplateMessage,
    record: recordBookingEvent,
    isConfigured: isWhatsAppConfigured,
    isSuppressed: (phone) => isPhoneSuppressed(db, phone),
  };
}

export type DeliverOutcome = "none" | "skipped" | "sent" | "failed";

const SKIP_TEXT: Record<ClientSkipReason, string> = {
  template_missing: "la plantilla elegida ya no existe",
  template_not_approved: "la plantilla elegida no está aprobada por Meta",
  template_unsupported: "la plantilla elegida no se puede enviar desde aquí",
  template_language: "la plantilla elegida no está en el idioma de la clienta",
  param_count: "los datos elegidos no coinciden con los de la plantilla",
  params_invalid: "los datos elegidos para la plantilla no son válidos",
  button_params:
    "la plantilla tiene un botón con un dato que aquí no se rellena",
};

/**
 * Decides, sends and records, for one booking whose rows have been read. Never
 * throws.
 *
 * A booking that would get NOTHING (no consent, no number, a number that said
 * STOP) writes nothing at all. One whose template cannot be sent writes a
 * single `skipped` entry with the reason. These are one-off events (the
 * confirmation, the first payment), so there is no stamp to claim: the
 * callers fire them once per event.
 */
export async function deliverClientWhatsApp(
  input: {
    bookingId: string;
    key: MessageKey;
    event: ClientWhatsAppEvent;
    locale: CampaignLocale;
    row: ClientMessageRow | null;
    template: WhatsAppTemplateRow | null;
    contact: ClientContact | null;
    booking: ClientBooking;
    actorId?: string | null;
    actorRole?: BookingEventActorRole | null;
  },
  deps: Pick<ClientWhatsAppDeps, "send" | "record" | "isSuppressed">,
): Promise<DeliverOutcome> {
  const first = decideClientWhatsApp({ ...input, phoneSuppressed: false });
  if (first.kind === "none") return "none";

  // The STOP list, read for the number this would go to and BEFORE anything is
  // sent or written. One that cannot be read counts as "suppressed": better
  // no message than one to somebody who asked for none.
  let suppressed = true;
  try {
    suppressed = await deps.isSuppressed(first.to);
  } catch (err) {
    console.error("[whatsapp/client] could not read the STOP list:", err);
  }
  const decision = suppressed
    ? decideClientWhatsApp({ ...input, phoneSuppressed: true })
    : first;
  if (decision.kind === "none") return "none";

  const entry = {
    bookingId: input.bookingId,
    channel: "whatsapp" as const,
    event: input.event,
    actorId: input.actorId ?? null,
    actorRole: input.actorRole ?? null,
    recipient: decision.to,
  };
  const write = async (full: BookingEventInput) => {
    try {
      await deps.record(full);
    } catch (err) {
      console.error("[whatsapp/client] could not record:", err);
    }
  };

  if (decision.kind === "off") {
    await write({
      ...entry,
      summary: whatsappOffSummary(input.key),
      status: "skipped",
      error: OFF_REASON,
    });
    return "skipped";
  }

  if (decision.kind === "skip") {
    await write({
      ...entry,
      summary: `WhatsApp a la clienta no se envió: ${SKIP_TEXT[decision.reason]}`,
      status: "skipped",
      error: decision.reason,
    });
    return "skipped";
  }

  let result: WhatsAppSendResult;
  let thrown = false;
  try {
    result = await deps.send(decision.send);
  } catch (err) {
    // A send that threw says nothing about whether Meta has the message.
    thrown = true;
    result = {
      status: "failed",
      error: err instanceof Error ? err.message : "Unknown WhatsApp error",
      ambiguous: true,
    };
  }
  // Not configured after all: nothing happened, so nothing is recorded.
  if (result.status === "skipped") return "none";

  const payload = {
    template: decision.template.name,
    params: decision.params,
    language: decision.template.language,
  };
  if (result.status === "sent") {
    await write({
      ...entry,
      summary: decision.preview,
      status: "sent",
      providerId: result.providerId,
      error: null,
      payload,
    });
    return "sent";
  }
  await write({
    ...entry,
    summary: decision.preview,
    status: "failed",
    providerId: null,
    error: result.error,
    payload:
      result.ambiguous || thrown ? { ...payload, ambiguous: true } : payload,
  });
  return "failed";
}

const MESSAGE_ROW_COLUMNS =
  "locale, enabled, whatsapp_template_id, whatsapp_params";
const CONTACT_COLUMNS =
  "first_name, last_name, phone, preferred_language, whatsapp_opted_in_at, whatsapp_opted_out_at, whatsapp_unreachable_at";

type BookingRowRead = {
  email: string | null;
  contact_id: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  service_title: string | null;
  date: string | null;
  time: string | null;
  // The SDK types an embedded relation as an array even when it is one row.
  service_tiers: { label: string | null }[] | { label: string | null } | null;
};

const tierLabelOf = (row: Pick<BookingRowRead, "service_tiers">) =>
  Array.isArray(row.service_tiers)
    ? (row.service_tiers[0]?.label ?? null)
    : (row.service_tiers?.label ?? null);

/** The columns of a booking a client message needs, for `select`. */
const CLIENT_BOOKING_COLUMNS =
  "email, contact_id, phone, first_name, last_name, service_title, date, time, service_tiers(label)";

/** A booking row as the facts a message is built from, or null if it lacks a date or time. */
function clientBookingOf(row: BookingRowRead): ClientBooking | null {
  if (!row.date || !row.time) return null;
  return {
    first_name: row.first_name,
    last_name: row.last_name,
    phone: row.phone,
    service_title: row.service_title,
    tier_label: tierLabelOf(row),
    date: row.date.slice(0, 10),
    time: row.time,
  };
}

/**
 * The saved WhatsApp rows of one message (both languages, in one read), or
 * null when there are none or they cannot be read.
 */
async function loadClientMessageRows(
  db: Db,
  key: MessageKey,
): Promise<ClientMessageRow[] | null> {
  const { data, error } = await db
    .from("message_templates")
    .select(MESSAGE_ROW_COLUMNS)
    .eq("key", key)
    .eq("channel", "whatsapp");
  if (error) {
    console.error("[whatsapp/client] could not read the message:", error);
    return null;
  }
  const rows = (data ?? []) as ClientMessageRow[];
  return rows.length > 0 ? rows : null;
}

async function loadClientTemplate(
  db: Db,
  id: string | null,
): Promise<WhatsAppTemplateRow | null> {
  if (!id) return null;
  const { data, error } = await db
    .from("whatsapp_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as WhatsAppTemplateRow | null) ?? null;
}

/**
 * The contact a booking belongs to, found the way consent is recorded: by the
 * booking's email, lowercased. Failing that, the contact the booking points
 * at.
 */
async function loadClientContact(
  db: Db,
  email: string | null,
  contactId: string | null,
): Promise<ClientContact | null> {
  // A read that fails is logged and treated as "no contact": nobody is written
  // to on a guess, and the reason is in the log instead of nowhere.
  if (email) {
    const { data, error } = await db
      .from("contacts")
      .select(CONTACT_COLUMNS)
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();
    if (error) console.error("[whatsapp/client] contact read failed:", error);
    if (data) return data as ClientContact;
  }
  if (contactId) {
    const { data, error } = await db
      .from("contacts")
      .select(CONTACT_COLUMNS)
      .eq("id", contactId)
      .maybeSingle();
    if (error) console.error("[whatsapp/client] contact read failed:", error);
    if (data) return data as ClientContact;
  }
  return null;
}

function defaultDeps(): ClientWhatsAppDeps {
  return makeClientDeps(getAdminClient().database);
}

/**
 * The WhatsApp for one booking event (`confirmed`, `paid`): reads what it
 * needs, one step at a time and stopping at the first thing that says "no".
 * With no saved row that is one read and nothing else; with WhatsApp not
 * configured, none at all. Never throws, and the callers await it AFTER
 * everything they did before it was added.
 */
export async function notifyClientOnWhatsApp(
  input: {
    bookingId: string;
    key: MessageKey;
    event: ClientWhatsAppEvent;
    /** The booking's language when the caller knows it. */
    locale?: string | null;
    actorId?: string | null;
    actorRole?: BookingEventActorRole | null;
  },
  injected?: ClientWhatsAppDeps,
): Promise<void> {
  try {
    // Built inside the `try`: even a database client that cannot be made must
    // not reach the caller.
    const deps = injected ?? defaultDeps();
    if (!MESSAGE_CATALOG[input.key].whatsappEligible) return;
    if (!deps.isConfigured()) return;

    const rows = await loadClientMessageRows(deps.db, input.key);
    if (!rows) return;

    const { data } = await deps.db
      .from("bookings")
      .select(CLIENT_BOOKING_COLUMNS)
      .eq("id", input.bookingId)
      .maybeSingle();
    const bookingRow = data as BookingRowRead | null;
    const booking = bookingRow ? clientBookingOf(bookingRow) : null;
    if (!bookingRow || !booking) return;

    const contact = await loadClientContact(
      deps.db,
      bookingRow.email,
      bookingRow.contact_id,
    );
    const locale = bookingLocale(input.locale, contact?.preferred_language);
    const row = rows.find((r) => r.locale === locale) ?? null;
    if (!row) return;

    // Consent and a number first: a template is not even read for a client
    // who would not be messaged.
    if (!clientRecipient(contact, booking)) return;
    const template = await loadClientTemplate(
      deps.db,
      row.whatsapp_template_id,
    );

    await deliverClientWhatsApp(
      {
        bookingId: input.bookingId,
        key: input.key,
        event: input.event,
        locale,
        row,
        template,
        contact,
        booking,
        actorId: input.actorId,
        actorRole: input.actorRole,
      },
      deps,
    );
  } catch (err) {
    console.error("[whatsapp/client] could not notify the client:", err);
  }
}
