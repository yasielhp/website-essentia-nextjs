import { whatsappTemplateEligibility } from "@/lib/campaigns/whatsapp-eligibility";
import type { TemplateIssue } from "@/lib/campaigns/whatsapp-eligibility";
import { resolveParams } from "@/lib/campaigns/whatsapp-params";
import { recordBookingEvent } from "@/lib/booking-events/record";
import type {
  BookingEventActorRole,
  BookingEventInput,
} from "@/lib/booking-events/types";
import { formatLongDate } from "@/lib/format-date";
import { getAdminClient } from "@/lib/insforge-admin";
import { MESSAGE_CATALOG, type MessageKey } from "@/lib/messages/catalog";
import type { CampaignLocale } from "@/types/campaign";
import {
  isWhatsAppConfigured,
  sendTemplateMessage,
  type TemplateSend,
} from "./client";
import { toCampaignPhone } from "./phone";
import { renderPreview } from "./templates";
import type {
  WhatsAppParamField,
  WhatsAppParamSource,
  WhatsAppSendResult,
  WhatsAppTemplateRow,
} from "./types";

/**
 * WhatsApp to the CLIENT about her own booking: the confirmation, the paid
 * confirmation and the reminder, on the template the admin chose for each.
 *
 * These are transactional notices, so what lets one go is the booking-notice
 * consent (`whatsapp_opted_in_at`, the checkbox that promises "the confirmation
 * and the reminder of my appointment"), never the marketing one. Nothing is
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

export type ClientWhatsAppEvent = "confirmed" | "paid" | "reminded";

/** The saved `message_templates` row of a WhatsApp message, as it is read. */
export type ClientMessageRow = {
  locale?: string | null;
  enabled: boolean | null;
  whatsapp_template_id: string | null;
  /** jsonb: whatever is stored. It is checked before it is used. */
  whatsapp_params: unknown;
};

export type ClientContact = {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  preferred_language: string | null;
  whatsapp_opted_in_at: string | null;
  whatsapp_opted_out_at: string | null;
  whatsapp_unreachable_at: string | null;
};

export type ClientBooking = {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  service_title: string | null;
  /** The session type's label, when the booking has one. */
  tier_label: string | null;
  /** YYYY-MM-DD, as stored. */
  date: string;
  /** `HH:MM`, or `HH:MM:SS` as Postgres hands it back. */
  time: string;
};

/** Why a chosen template could not be sent, beyond the template's own state. */
export type ClientSkipReason =
  | TemplateIssue
  | "params_invalid"
  /** A URL button with a `{{n}}` suffix: nothing here fills it. */
  | "button_params";

export type ClientWhatsAppDecision =
  | { kind: "none" }
  | { kind: "skip"; reason: ClientSkipReason; to: string }
  | {
      kind: "send";
      to: string;
      send: TemplateSend;
      params: string[];
      /** The body as the client reads it. */
      preview: string;
      template: WhatsAppTemplateRow;
    };

/**
 * The language of a booking: the one the caller knows, else the contact's
 * stored preference, else Spanish, the house default.
 */
export function bookingLocale(
  payloadLocale: string | null | undefined,
  contactLanguage: string | null | undefined,
): CampaignLocale {
  for (const candidate of [payloadLocale, contactLanguage]) {
    if (candidate === "en" || candidate === "es") return candidate;
  }
  return "es";
}

/** The booking-notice consent, with neither the opt-out nor the unreachable stamp. */
export function hasClientConsent(contact: ClientContact | null): boolean {
  return Boolean(
    contact &&
    contact.whatsapp_opted_in_at &&
    !contact.whatsapp_opted_out_at &&
    !contact.whatsapp_unreachable_at,
  );
}

/**
 * The number to write to: the one typed on the booking when it is valid, else
 * the contact's. Null when neither is a number the database accepts.
 */
export function clientPhone(
  contact: Pick<ClientContact, "phone"> | null,
  booking: Pick<ClientBooking, "phone">,
): string | null {
  return toCampaignPhone(booking.phone) ?? toCampaignPhone(contact?.phone);
}

// Every field a source may name; a field added to the type is a type error here.
const PARAM_FIELDS: Record<WhatsAppParamField, true> = {
  first_name: true,
  last_name: true,
  service: true,
  session_type: true,
  date: true,
  time: true,
  post_title: true,
  post_url: true,
};

/** The stored parameter list as sources, or null when it is not one. */
function readSources(value: unknown): WhatsAppParamSource[] | null {
  if (!Array.isArray(value)) return null;
  const sources: WhatsAppParamSource[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) return null;
    const source = item as Record<string, unknown>;
    if (
      source.kind === "field" &&
      typeof source.field === "string" &&
      source.field in PARAM_FIELDS
    ) {
      sources.push({
        kind: "field",
        field: source.field as WhatsAppParamField,
      });
    } else if (source.kind === "static" && typeof source.value === "string") {
      sources.push({ kind: "static", value: source.value });
    } else {
      return null;
    }
  }
  return sources;
}

export function decideClientWhatsApp(input: {
  key: MessageKey;
  locale: CampaignLocale;
  row: ClientMessageRow | null;
  template: WhatsAppTemplateRow | null;
  contact: ClientContact | null;
  booking: ClientBooking;
}): ClientWhatsAppDecision {
  const { key, locale, row, template, contact, booking } = input;
  const definition = MESSAGE_CATALOG[key];
  if (!definition.whatsappEligible) return { kind: "none" };
  if (!row || !row.whatsapp_template_id) return { kind: "none" };
  // Only a message that can be switched off can be switched off: for the rest
  // the switch is ignored, as it is for the email.
  if (row.enabled === false && definition.canDisable) return { kind: "none" };

  if (!hasClientConsent(contact)) return { kind: "none" };
  const to = clientPhone(contact, booking);
  if (!to) return { kind: "none" };

  // From here the client would have been messaged: a template that cannot be
  // sent is the admin's to fix, and shows.
  const sources = readSources(row.whatsapp_params);
  if (!sources) return { kind: "skip", reason: "params_invalid", to };
  const issue = whatsappTemplateEligibility(template, locale, sources);
  if (issue || !template) {
    return { kind: "skip", reason: issue ?? "template_missing", to };
  }

  // Our send fills the body and no button. A button whose address ends in a
  // `{{n}}` would be refused by Meta every time, so it is a misconfiguration
  // to show, not a message to try.
  if (
    template.buttons.some(
      (button) => button.type === "URL" && button.url.includes("{{"),
    )
  ) {
    return { kind: "skip", reason: "button_params", to };
  }

  const clean = (value: string | null | undefined) => (value ?? "").trim();
  const vars: Record<string, string> = {
    service: clean(booking.service_title),
    session_type: clean(booking.tier_label),
    // The same long date, with the weekday, the staff notice uses.
    date: formatLongDate(booking.date, locale),
    time: clean(booking.time).slice(0, 5),
  };
  const params = resolveParams(
    sources,
    {
      id: "",
      email: "",
      language: locale,
      firstName: clean(contact?.first_name) || clean(booking.first_name),
      lastName: clean(contact?.last_name) || clean(booking.last_name),
    },
    vars,
  );
  return {
    kind: "send",
    to,
    params,
    preview: renderPreview(template.body, params),
    template,
    send: {
      to,
      name: template.name,
      language: template.language,
      bodyParams: params,
    },
  };
}

// ── effects ────────────────────────────────────────────────────────────────

type Db = ReturnType<typeof getAdminClient>["database"];

export type ClientWhatsAppDeps = {
  db: Db;
  send: (send: TemplateSend) => Promise<WhatsAppSendResult>;
  record: (entry: BookingEventInput) => Promise<void>;
  isConfigured: () => boolean;
};

export type DeliverOutcome = "none" | "lost" | "skipped" | "sent" | "failed";

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
 * Decides, claims, sends and records, for one booking whose rows have been
 * read. Never throws.
 *
 * `claim` is for the reminder: it must stamp the booking with a conditional
 * update and answer whether THIS run won it. It is taken after the decision
 * (a booking that would get nothing is not stamped) and before anything is
 * sent or written, so two overlapping runs cannot both send. One that throws
 * counts as lost: better no message than two.
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
    claim?: () => Promise<boolean>;
  },
  deps: Pick<ClientWhatsAppDeps, "send" | "record">,
): Promise<DeliverOutcome> {
  const decision = decideClientWhatsApp(input);
  if (decision.kind === "none") return "none";

  if (input.claim) {
    let won = false;
    try {
      won = await input.claim();
    } catch (err) {
      console.error("[whatsapp/client] claim failed:", err);
    }
    if (!won) return "lost";
  }

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
export const CONTACT_COLUMNS =
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
export const CLIENT_BOOKING_COLUMNS =
  "email, contact_id, phone, first_name, last_name, service_title, date, time, service_tiers(label)";

/** A booking row as the facts a message is built from, or null if it lacks a date or time. */
export function clientBookingOf(row: BookingRowRead): ClientBooking | null {
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
export async function loadClientMessageRows(
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

export async function loadClientTemplate(
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
  if (email) {
    const { data } = await db
      .from("contacts")
      .select(CONTACT_COLUMNS)
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();
    if (data) return data as ClientContact;
  }
  if (contactId) {
    const { data } = await db
      .from("contacts")
      .select(CONTACT_COLUMNS)
      .eq("id", contactId)
      .maybeSingle();
    if (data) return data as ClientContact;
  }
  return null;
}

function defaultDeps(): ClientWhatsAppDeps {
  return {
    db: getAdminClient().database,
    send: sendTemplateMessage,
    record: recordBookingEvent,
    isConfigured: isWhatsAppConfigured,
  };
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
    if (!hasClientConsent(contact) || !clientPhone(contact, booking)) return;
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
