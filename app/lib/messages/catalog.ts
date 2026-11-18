/**
 * The catalogue of messages the centre can edit from the dashboard.
 *
 * Pure on purpose: the dashboard list, the editor's variable chips, the
 * validation in the Server Actions and the renderer all read this one table,
 * so none of them can disagree about what a message offers.
 *
 * What lives here is what the code guarantees, not what an admin writes:
 * the variables a message can fill, and the blocks the code adds after the
 * body whatever the admin wrote. The inventory these were taken from, with the
 * current text of every email, is `docs/plans/2026-11-17-message-inventory.md`.
 */

export const MESSAGE_KEYS = [
  "booking_received",
  "booking_confirmed",
  "booking_paid",
  "booking_rescheduled",
  "booking_cancelled",
  "booking_reminder",
  "consent_request",
  "bonus_purchase",
] as const;

export type MessageKey = (typeof MESSAGE_KEYS)[number];

export type MessageVariable =
  | "first_name"
  | "service"
  | "session_type"
  /**
   * Whatever the caller passes, already formatted. There is no single format
   * today: the booking events, the self-service cancellation and the reminder
   * print "jueves, 20 de agosto de 2026", the paid confirmation prints
   * "20 de agosto de 2026" (no weekday). Defaults must keep each message's
   * current format; formats are not unified.
   */
  | "date"
  | "time"
  | "duration"
  /**
   * What is still owed at the centre. Empty when nothing is. Both messages
   * print it as their legacy email does: `booking_paid` through `formatPrice`
   * ("25,00 €"), `booking_received` as the bare number with the sign on the
   * language's side ("45 €" / "€45"). In `booking_received` the caller passes
   * null today, so it is always empty.
   */
  | "amount_due"
  /**
   * What the client paid in THIS payment, formatted with the currency. For a
   * deposit followed by the balance, each email carries its own payment, not
   * the running total.
   */
  | "amount_paid"
  /** Vouchers: how many sessions it holds. */
  | "sessions"
  /** Vouchers: the last day it can be used, already formatted. */
  | "expires_on"
  | "cancel_url"
  | "consent_url";

/**
 * What the code adds after the body, outside the admin's reach: they carry
 * data, links and rules the editor cannot be trusted to keep intact.
 */
export type FixedBlock =
  /** Service / session type / date / time / duration (and payment rows). */
  | "details_card"
  /** The centre's address. */
  | "location"
  /** A sentence that exists only when something is owed at the centre. */
  | "payment_note"
  | "calendar_button"
  | "cancel_link"
  | "consent_button"
  /** Vouchers: service / sessions / amount paid / valid until. */
  | "bonus_card";

/**
 * Which blocks can be taken out of a message. A block that does a job (the link
 * to cancel, the button to sign, the notice of what is still owed, the voucher's
 * card) is `required`: the document of a message that lacks one is refused when
 * saved, and sending adds it back, so no email ever goes out without it. The
 * ones that only inform (the booking's details, the address, the calendar
 * button) can be removed. Every block can be moved.
 */
export const FIXED_BLOCK_INFO: Record<FixedBlock, { required: boolean }> = {
  details_card: { required: false },
  location: { required: false },
  payment_note: { required: true },
  calendar_button: { required: false },
  cancel_link: { required: true },
  consent_button: { required: true },
  bonus_card: { required: true },
};

export const isRequiredBlock = (block: FixedBlock): boolean =>
  FIXED_BLOCK_INFO[block].required;

/** The blocks of a message that cannot be removed, in its order. */
export function requiredBlocks(key: MessageKey): FixedBlock[] {
  return MESSAGE_CATALOG[key].fixed.filter(isRequiredBlock);
}

export type MessageDefinition = {
  variables: MessageVariable[];
  /** The blocks the code draws, in the order the email has always printed them. */
  fixed: FixedBlock[];
  /**
   * The blocks (a subset of `fixed`) the email has always printed AFTER its
   * closing sentence; the rest come before it. Only the request-received email
   * has one: its cancellation link comes under the closing line.
   */
  afterClosing: FixedBlock[];
  /**
   * Whether the admin may switch the message off. Only the reminder: it is the
   * one nobody is owed. Switching off the confirmation would leave a client who
   * has paid without their email.
   */
  canDisable: boolean;
  /**
   * Whether the message may also go out on WhatsApp. Two conditions: the
   * client opted in to hear about exactly this (the checkbox promises "the
   * confirmation and the reminder of my appointment"), and the message hangs
   * off a booking, which is how the sender finds their number.
   */
  whatsappEligible: boolean;
};

// A link variable exists exactly where a fixed block carries that link, and
// nowhere else: that is what a WhatsApp template needs for its button and what
// an email body could meaningfully quote.
export const MESSAGE_CATALOG: Record<MessageKey, MessageDefinition> = {
  booking_received: {
    variables: [
      "first_name",
      "service",
      "session_type",
      "date",
      "time",
      "duration",
      "amount_due",
      "cancel_url",
    ],
    fixed: ["details_card", "payment_note", "cancel_link"],
    afterClosing: ["cancel_link"],
    canDisable: false,
    // An acknowledgement of a request, not the confirmation the client opted
    // in to hear about.
    whatsappEligible: false,
  },
  booking_confirmed: {
    variables: [
      "first_name",
      "service",
      "session_type",
      "date",
      "time",
      "duration",
      "cancel_url",
      "consent_url",
    ],
    fixed: [
      "details_card",
      "location",
      "calendar_button",
      "consent_button",
      "cancel_link",
    ],
    afterClosing: [],
    canDisable: false,
    whatsappEligible: true,
  },
  // The email that follows an online payment (Redsys webhook). A different
  // email from `booking_confirmed`, with its own text and its own payment rows.
  booking_paid: {
    variables: [
      "first_name",
      "service",
      "date",
      "time",
      "duration",
      "amount_paid",
      "amount_due",
      "consent_url",
    ],
    fixed: [
      "details_card",
      "location",
      "payment_note",
      "calendar_button",
      "consent_button",
    ],
    afterClosing: [],
    canDisable: false,
    // A confirmation, and the paid booking has a booking behind it.
    whatsappEligible: true,
  },
  booking_rescheduled: {
    variables: [
      "first_name",
      "service",
      "session_type",
      "date",
      "time",
      "duration",
      "cancel_url",
    ],
    fixed: ["details_card", "calendar_button", "cancel_link"],
    afterClosing: [],
    canDisable: false,
    // The opt-in text names confirmation and reminder only.
    whatsappEligible: false,
  },
  booking_cancelled: {
    variables: [
      "first_name",
      "service",
      "session_type",
      "date",
      "time",
      "duration",
    ],
    fixed: ["details_card"],
    afterClosing: [],
    canDisable: false,
    whatsappEligible: false,
  },
  booking_reminder: {
    variables: [
      "first_name",
      "service",
      "session_type",
      "date",
      "time",
      "duration",
      "cancel_url",
    ],
    fixed: ["details_card", "location", "calendar_button", "cancel_link"],
    afterClosing: [],
    canDisable: true,
    // Its WhatsApp version is not a message here but an appointment notice (a
    // campaign of that kind), which can be set several times and at any hour
    // before or after the booking. One fixed WhatsApp reminder as well would
    // mean two messages for one appointment.
    whatsappEligible: false,
  },
  consent_request: {
    variables: ["first_name", "consent_url"],
    fixed: ["consent_button"],
    afterClosing: [],
    canDisable: false,
    // No booking behind it: the sender could not find a number to write to.
    whatsappEligible: false,
  },
  bonus_purchase: {
    variables: [
      "first_name",
      "service",
      "sessions",
      "amount_paid",
      "expires_on",
    ],
    fixed: ["bonus_card"],
    afterClosing: [],
    canDisable: false,
    // Bought on the website, with no booking and no WhatsApp opt-in.
    whatsappEligible: false,
  },
};

/**
 * Where each message is written today. The renderer falls back to these until
 * the new path has proved itself end to end, and the defaults are copied from
 * them, so this is the map from a key to the code it replaces.
 *
 * Callers, parameters and current text: the inventory document.
 */
export const LEGACY_TEMPLATES: Record<
  MessageKey,
  { file: string; fn: string }
> = {
  booking_received: {
    file: "app/emails/templates/booking-received.ts",
    fn: "bookingReceivedEmail",
  },
  booking_confirmed: {
    file: "app/emails/templates/booking-confirmed.ts",
    fn: "bookingConfirmedEmail",
  },
  booking_paid: {
    file: "app/emails/templates/booking-confirmation.ts",
    fn: "bookingConfirmationEmail",
  },
  booking_rescheduled: {
    file: "app/emails/templates/booking-rescheduled.ts",
    fn: "bookingRescheduledEmail",
  },
  booking_cancelled: {
    file: "app/emails/templates/booking-cancelled.ts",
    fn: "bookingCancelledEmail",
  },
  booking_reminder: {
    file: "app/emails/templates/booking-reminder.ts",
    fn: "bookingReminderEmail",
  },
  consent_request: {
    file: "app/emails/templates/consent-request.ts",
    fn: "consentRequestEmail",
  },
  bonus_purchase: {
    file: "app/emails/templates/bonus-purchase.ts",
    fn: "bonusPurchaseEmail",
  },
};

// The same shape the renderer uses to find a token (`renderVariables` in
// app/lib/campaigns/body-html.ts, minus its leading space): a token it would
// swallow as empty must be flagged here, capitals and digits included.
const TOKEN = /\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi;

/** `{{x}}` tokens a text uses that the message does not offer, once each. */
export function unknownVariables(key: MessageKey, text: string): string[] {
  const offered = new Set<string>(MESSAGE_CATALOG[key].variables);
  const unknown = new Set<string>();
  for (const match of text.matchAll(TOKEN)) {
    const name = match[1];
    if (name && !offered.has(name)) unknown.add(name);
  }
  return [...unknown];
}
