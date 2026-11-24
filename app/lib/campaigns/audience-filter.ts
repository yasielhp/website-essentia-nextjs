import { toCampaignPhone } from "@/lib/whatsapp/phone";
import { conditionsMatch } from "./conditions";
import { recipientLocale } from "./languages";
import type {
  CampaignAudience,
  ConsentPurpose,
  CampaignChannel,
  CampaignLocale,
} from "@/types/campaign";

/**
 * Who a campaign reaches, decided over plain values.
 *
 * This file knows nothing about the database so the rules can be tested with
 * fixtures and the DB wrapper (`audience.ts`) stays a thin fetch. The same
 * function serves the dashboard preview and the dispatch, so the count the
 * admin sees is the list the send uses.
 */

/**
 * One booking, as a message talks about it. `date` and `time` are the local
 * wall-clock strings the booking was saved with (`YYYY-MM-DD`, `HH:MM`): they
 * are shown as they are and never turned into an instant here.
 */
export type VisitInfo = {
  /** The booked service's title; empty when the booking carries none. */
  service: string;
  /** The session type's label (`service_tiers.label`), when it has one. */
  sessionType: string | null;
  date: string;
  time: string;
};

/**
 * One booking of a contact, as an appointment notice sees it: when it starts
 * and ends as instants (the wall clock of the Canaries, converted once, where
 * the bookings are read), what a message says about it, and which service it
 * is for. Only confirmed and completed bookings are ever here.
 */
export type Appointment = {
  id: string;
  /** `bookableServices` id, for the campaign's service condition. */
  serviceId: string | null;
  status: "confirmed" | "completed";
  /** ISO instant. A booking with no time starts at the day's first moment. */
  startsAt: string;
  /** ISO instant; equal to `startsAt` when the booking has no length. */
  endsAt: string;
  visit: VisitInfo;
};

export type ContactCandidate = {
  id: string;
  /** Empty for a contact that only has a phone; the email channel drops those. */
  email: string;
  firstName: string;
  language: string | null;
  newsletter: boolean;
  bouncedAt: string | null;
  /** Set when the contact asked to be left alone; nothing overrides it. */
  unsubscribedAt: string | null;
  /** YYYY-MM-DD of the most recent non-cancelled booking, or null. */
  lastBookingDate: string | null;
  serviceIds: string[];
  bookingsCount: number;
  /** YYYY-MM-DD of the earliest non-cancelled booking, for anniversaries. */
  firstBookingDate?: string | null;
  /** When the contact said yes to the newsletter, for autoresponders. */
  subscribedAt?: string | null;
  /** YYYY-MM-DD, for birthday campaigns. */
  birthdate?: string | null;
  lastName?: string | null;
  phone?: string | null;
  /** ISO instant at which the earliest confirmed/completed booking ends. */
  firstVisitEndsAt?: string | null;
  /**
   * The same, per session type (`tier_id`): when the earliest confirmed or
   * completed booking of each type ends. A campaign limited to one type waits
   * for the first visit of *that* type, not for the first visit of any.
   */
  firstVisitEndsAtByTier?: Record<string, string>;
  /** How many bookings are confirmed or completed. */
  confirmedBookingsCount?: number;
  /** The latest non-cancelled booking, for `after_booking`. */
  lastVisit?: VisitInfo | null;
  /** The earliest confirmed or completed booking, for `first_visit`. */
  firstVisit?: VisitInfo | null;
  /** The same, per session type (`tier_id`). */
  firstVisitByTier?: Record<string, VisitInfo>;
  /**
   * Every confirmed or completed booking, for an appointment notice. Loaded
   * only for that kind of campaign: nothing else reads it.
   */
  appointments?: Appointment[];
  /**
   * Consent to WhatsApp *campaigns*. Not `whatsapp_opted_in_at`, which only
   * covers booking notices: the two purposes are consented separately.
   */
  whatsappMarketingOptedInAt?: string | null;
  /**
   * Consent to WhatsApp notices about her own appointments (the booking
   * form's box), which is what an appointment campaign needs. Not the one
   * above, and neither stands in for the other.
   */
  whatsappOptedInAt?: string | null;
  /** STOP / BAJA: one opt-out that blocks both uses. */
  whatsappOptedOutAt?: string | null;
  /** Meta said the number has no WhatsApp; sending again only costs. */
  whatsappUnreachableAt?: string | null;
};

export type Recipient = {
  id: string;
  /**
   * Lowercased address. Null in a WhatsApp recipient: the address there is the
   * phone, and the row stores NULL (an empty string would collide on the
   * unique index, and two contacts sharing an email must not). The email
   * channel never produces null.
   */
  email: string | null;
  firstName: string;
  language: CampaignLocale;
  /** Carried through for the automation rules; the send ignores them. */
  lastBookingDate?: string | null;
  firstBookingDate?: string | null;
  /**
   * When the contact joined what the campaign is about: the newsletter, or on
   * WhatsApp the day they agreed to receive news there. Greets the
   * `newsletter_subscribed` rule.
   */
  subscribedAt?: string | null;
  /**
   * What makes one subscription different from the next, so the rule greets
   * once per consent and not once per life. Absent on email, where the
   * newsletter is joined once and the greeting is sent once. On WhatsApp it is
   * the consent's own instant: a contact who says STOP and consents again has
   * a new one, and is welcomed again.
   */
  subscriptionCycle?: string;
  birthdate?: string | null;
  lastName?: string | null;
  /** In a WhatsApp recipient: the campaign phone, always E.164. */
  phone?: string | null;
  newsletter?: boolean;
  firstVisitEndsAt?: string | null;
  firstVisitEndsAtByTier?: Record<string, string>;
  confirmedBookingsCount?: number;
  /** What the automation rules put in the message; see `ContactCandidate`. */
  lastVisit?: VisitInfo | null;
  firstVisit?: VisitInfo | null;
  firstVisitByTier?: Record<string, VisitInfo>;
  /** Only on a recipient of an appointment notice. */
  appointments?: Appointment[];
};

/**
 * The exclusions nobody can override, hand-picked contacts included. They are
 * per channel because consent is: the newsletter unsubscribe and an email
 * bounce say nothing about WhatsApp, and a WhatsApp opt-out nothing about
 * email.
 *
 * Email: a hand-picked contact still needs a deliverable address, and a
 * bounced one would only bounce again and hurt the sender reputation.
 * WhatsApp: a marketing template needs the contact's own marketing consent,
 * and never goes to one who opted out, to a number without WhatsApp, or to
 * one the database would refuse.
 *
 * Returns the address the send goes to (the lowercased email, or the E.164
 * phone), which is also what de-duplicates, or null when excluded.
 */
function contactPoint(
  candidate: ContactCandidate,
  channel: CampaignChannel,
  purpose: ConsentPurpose,
): string | null {
  if (channel === "whatsapp") {
    // The consent is the one the campaign is for: a notice about her own
    // appointment needs the box that promises it, news and offers need theirs.
    const consent =
      purpose === "appointment"
        ? candidate.whatsappOptedInAt
        : candidate.whatsappMarketingOptedInAt;
    if (
      !consent ||
      candidate.whatsappOptedOutAt ||
      candidate.whatsappUnreachableAt
    ) {
      return null;
    }
    return toCampaignPhone(candidate.phone);
  }
  if (
    candidate.bouncedAt !== null ||
    !candidate.email.includes("@") ||
    candidate.unsubscribedAt !== null
  ) {
    return null;
  }
  return candidate.email.trim().toLowerCase();
}

/** The instant as ISO in UTC, or null when it does not read as one. */
function isoOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

export function filterAudience(
  candidates: ContactCandidate[],
  audience: CampaignAudience,
  now: Date,
  channel: CampaignChannel = "email",
  /**
   * The E.164 numbers that wrote STOP. Only WhatsApp reads them: a contact on
   * one is left out whatever the consent says and even when hand-picked, since
   * the number may belong to somebody else than the contact it sits on.
   */
  suppressedPhones: ReadonlySet<string> = new Set(),
  /**
   * What the campaign is for, which decides the consent it needs (WhatsApp
   * only; email has one). A notice about her appointment also ignores
   * hand-picked contacts: its audience is the appointments, and nobody is
   * added to it by hand. Marketing unless said otherwise.
   */
  purpose: ConsentPurpose = "marketing",
): Recipient[] {
  const manual = new Set(purpose === "appointment" ? [] : audience.manualIds);
  // A hand-made list is those people and nobody else; the conditions are only
  // how they were found.
  const manualOnly = audience.manualOnly === true;
  const seen = new Set<string>();
  const recipients: Recipient[] = [];

  for (const candidate of candidates) {
    const point = contactPoint(candidate, channel, purpose);
    if (point === null) continue;
    if (channel === "whatsapp" && suppressedPhones.has(point)) continue;
    if (
      manualOnly
        ? !manual.has(candidate.id)
        : !manual.has(candidate.id) &&
          !conditionsMatch(candidate, audience, now)
    ) {
      continue;
    }
    // `campaign_recipients` is unique on (campaign_id, email) and on
    // (campaign_id, phone), so two contacts sharing an address or a number,
    // whatever the casing or the spacing, collapse into one row: the first.
    if (seen.has(point)) continue;
    seen.add(point);
    // On WhatsApp "subscribed" is the consent to receive news there, not the
    // newsletter: a contact can have either without the other.
    const consentAt =
      channel === "whatsapp" && purpose === "marketing"
        ? isoOrNull(candidate.whatsappMarketingOptedInAt)
        : null;
    recipients.push({
      id: candidate.id,
      email: channel === "whatsapp" ? null : point,
      firstName: candidate.firstName,
      lastBookingDate: candidate.lastBookingDate,
      firstBookingDate: candidate.firstBookingDate ?? null,
      subscribedAt:
        channel === "whatsapp" ? consentAt : (candidate.subscribedAt ?? null),
      ...(consentAt ? { subscriptionCycle: consentAt } : {}),
      birthdate: candidate.birthdate ?? null,
      lastName: candidate.lastName ?? null,
      phone: channel === "whatsapp" ? point : (candidate.phone ?? null),
      newsletter: candidate.newsletter,
      firstVisitEndsAt: candidate.firstVisitEndsAt ?? null,
      firstVisitEndsAtByTier: candidate.firstVisitEndsAtByTier ?? {},
      confirmedBookingsCount: candidate.confirmedBookingsCount ?? 0,
      lastVisit: candidate.lastVisit ?? null,
      firstVisit: candidate.firstVisit ?? null,
      firstVisitByTier: candidate.firstVisitByTier ?? {},
      // Only a WhatsApp notice talks about her bookings.
      ...(channel === "whatsapp" && candidate.appointments
        ? { appointments: candidate.appointments }
        : {}),
      // Each contact is written to in HER language, on both channels: the
      // email block, or the WhatsApp template, of that language (and the
      // visit date a notice carries is written in it). An audience that
      // fixes a language has only that version, so everybody on it gets it,
      // hand-picked contacts included.
      language: recipientLocale(audience, candidate.language),
    });
  }

  return recipients;
}
