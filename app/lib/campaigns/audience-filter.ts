import type { CampaignAudience, CampaignLocale } from "@/types/campaign";

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
};

export type Recipient = {
  id: string;
  email: string;
  firstName: string;
  language: CampaignLocale;
};

const DAY_MS = 86_400_000;

/** Only Spanish is stored as a real preference; every other value means English. */
function toLocale(language: string | null): CampaignLocale {
  return language === "es" ? "es" : "en";
}

/**
 * The exclusions nobody can override: a hand-picked contact still needs a
 * deliverable address, and a bounced one would only bounce again and hurt
 * the sender reputation.
 */
function isSendable(candidate: ContactCandidate): boolean {
  return (
    candidate.bouncedAt === null &&
    candidate.email.includes("@") &&
    candidate.unsubscribedAt === null
  );
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
): Recipient[] {
  const manual = new Set(audience.manualIds);
  const seen = new Set<string>();
  const recipients: Recipient[] = [];

  for (const candidate of candidates) {
    if (!isSendable(candidate)) continue;
    if (
      !manual.has(candidate.id) &&
      !matchesConditions(candidate, audience, now)
    ) {
      continue;
    }
    // `campaign_recipients` is unique on (campaign_id, email), so two contacts
    // sharing an address, whatever the casing, must collapse into one row.
    const email = candidate.email.trim().toLowerCase();
    if (seen.has(email)) continue;
    seen.add(email);
    recipients.push({
      id: candidate.id,
      email,
      firstName: candidate.firstName,
      // A campaign written in one language is sent in that language to
      // everyone on it, hand-picked contacts included: the other block is
      // allowed to be empty, and an empty email is worse than a foreign one.
      language:
        audience.language === "any"
          ? toLocale(candidate.language)
          : audience.language,
    });
  }

  return recipients;
}
