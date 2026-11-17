import { toCampaignPhone } from "@/lib/whatsapp/phone";
import type {
  CampaignAudience,
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
  /**
   * Consent to WhatsApp *campaigns*. Not `whatsapp_opted_in_at`, which only
   * covers booking notices: the two purposes are consented separately.
   */
  whatsappMarketingOptedInAt?: string | null;
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
  subscribedAt?: string | null;
  birthdate?: string | null;
  lastName?: string | null;
  /** In a WhatsApp recipient: the campaign phone, always E.164. */
  phone?: string | null;
  newsletter?: boolean;
  firstVisitEndsAt?: string | null;
  firstVisitEndsAtByTier?: Record<string, string>;
  confirmedBookingsCount?: number;
};

const DAY_MS = 86_400_000;

/** Only Spanish is stored as a real preference; every other value means English. */
function toLocale(language: string | null): CampaignLocale {
  return language === "es" ? "es" : "en";
}

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
): string | null {
  if (channel === "whatsapp") {
    if (
      !candidate.whatsappMarketingOptedInAt ||
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

function matchesConditions(
  candidate: ContactCandidate,
  audience: CampaignAudience,
  now: Date,
): boolean {
  if (
    audience.language !== "any" &&
    toLocale(candidate.language) !== audience.language
  ) {
    return false;
  }
  if (audience.newsletter === true && !candidate.newsletter) return false;
  if (
    audience.services.length > 0 &&
    !audience.services.some((id) => candidate.serviceIds.includes(id))
  ) {
    return false;
  }
  if (audience.neverBooked && candidate.bookingsCount !== 0) return false;
  if (audience.hasBooked && candidate.bookingsCount === 0) return false;
  if (audience.lastBooking) {
    // A contact who never booked has no "last booking" to compare, so the
    // condition cannot hold for them, whichever way it points.
    if (!candidate.lastBookingDate) return false;
    const bookedAt = Date.parse(`${candidate.lastBookingDate}T00:00:00Z`);
    const ageDays = (now.getTime() - bookedAt) / DAY_MS;
    const { op, days } = audience.lastBooking;
    // Strict on both sides: "more than 30 days" and "less than 30 days" are
    // both false at exactly 30, which is what the words say.
    if (op === "gt" ? !(ageDays > days) : !(ageDays < days)) return false;
  }
  return true;
}

export function filterAudience(
  candidates: ContactCandidate[],
  audience: CampaignAudience,
  now: Date,
  channel: CampaignChannel = "email",
): Recipient[] {
  const manual = new Set(audience.manualIds);
  const seen = new Set<string>();
  const recipients: Recipient[] = [];

  for (const candidate of candidates) {
    const point = contactPoint(candidate, channel);
    if (point === null) continue;
    if (
      !manual.has(candidate.id) &&
      !matchesConditions(candidate, audience, now)
    ) {
      continue;
    }
    // `campaign_recipients` is unique on (campaign_id, email) and on
    // (campaign_id, phone), so two contacts sharing an address or a number,
    // whatever the casing or the spacing, collapse into one row: the first.
    if (seen.has(point)) continue;
    seen.add(point);
    recipients.push({
      id: candidate.id,
      email: channel === "whatsapp" ? null : point,
      firstName: candidate.firstName,
      lastBookingDate: candidate.lastBookingDate,
      firstBookingDate: candidate.firstBookingDate ?? null,
      subscribedAt: candidate.subscribedAt ?? null,
      birthdate: candidate.birthdate ?? null,
      lastName: candidate.lastName ?? null,
      phone: channel === "whatsapp" ? point : (candidate.phone ?? null),
      newsletter: candidate.newsletter,
      firstVisitEndsAt: candidate.firstVisitEndsAt ?? null,
      firstVisitEndsAtByTier: candidate.firstVisitEndsAtByTier ?? {},
      confirmedBookingsCount: candidate.confirmedBookingsCount ?? 0,
      // A campaign written in one language is sent in that language to
      // everyone on it, hand-picked contacts included: the other block is
      // allowed to be empty, and an empty email is worse than a foreign one.
      language:
        audience.language !== "any"
          ? audience.language
          : (audience.sendLocale ?? toLocale(candidate.language)),
    });
  }

  return recipients;
}
