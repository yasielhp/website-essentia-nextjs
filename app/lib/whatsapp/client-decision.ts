import { whatsappTemplateEligibility } from "@/lib/campaigns/whatsapp-eligibility";
import type { TemplateIssue } from "@/lib/campaigns/whatsapp-eligibility";
import { resolveParams } from "@/lib/campaigns/whatsapp-params";
import { formatLongDate } from "@/lib/format-date";
import { MESSAGE_CATALOG, type MessageKey } from "@/lib/messages/catalog";
import type { CampaignLocale } from "@/types/campaign";
import type { TemplateSend } from "./client";
import { toCampaignPhone } from "./phone";
import { renderPreview } from "./templates";
import type {
  WhatsAppParamField,
  WhatsAppParamSource,
  WhatsAppTemplateRow,
} from "./types";

/**
 * The decision half of the client's WhatsApp notices: over plain values, with
 * no database, no clock and no network. The effects (reads, the claim, the
 * send, the history) are in `notify-client.ts`, which re-exports everything
 * here, so callers keep importing from one place.
 *
 * See `notify-client.ts` for the rules this decides.
 */

export type ClientWhatsAppEvent = "confirmed" | "paid" | "reminded";

/** The saved `message_templates` row of a WhatsApp message, as it is read. */
export type ClientMessageRow = {
  locale?: string | null;
  /** When the admin last saved it. The reminder does not reach back before it. */
  updated_at?: string | null;
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

/**
 * The number to write to, when the client may be written to at all: she has
 * the booking-notice consent (no opt-out, not unreachable) AND a number the
 * database accepts. Null otherwise. The one place that rule is spelled out;
 * the decision, the loader and the cron all ask it.
 */
export function clientRecipient(
  contact: ClientContact | null,
  booking: Pick<ClientBooking, "phone">,
): string | null {
  return hasClientConsent(contact) ? clientPhone(contact, booking) : null;
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
  /**
   * The number said STOP at some point (`whatsapp_suppressed_phones`), on any
   * contact or none. It beats any consent: the consent is on a contact, and
   * the number may belong to somebody else.
   */
  phoneSuppressed: boolean;
}): ClientWhatsAppDecision {
  const { key, locale, row, template, contact, booking } = input;
  const definition = MESSAGE_CATALOG[key];
  if (!definition.whatsappEligible) return { kind: "none" };
  if (!row || !row.whatsapp_template_id) return { kind: "none" };
  // Only a message that can be switched off can be switched off: for the rest
  // the switch is ignored, as it is for the email.
  if (row.enabled === false && definition.canDisable) return { kind: "none" };

  const to = clientRecipient(contact, booking);
  if (!to) return { kind: "none" };
  if (input.phoneSuppressed) return { kind: "none" };

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
