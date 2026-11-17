import type { CampaignAudience, CampaignLocale } from "@/types/campaign";

/**
 * Whether a contact meets an audience's conditions (language, subscription,
 * services, bookings), over plain values and nothing else. It lives apart from
 * the resolver so the browser can use the very same rule when a screen filters
 * people it already has: what the admin sees filtered is what the send resolves.
 */

/** What the conditions read about a contact. */
export type ConditionFacts = {
  language: string | null;
  newsletter: boolean;
  serviceIds: string[];
  bookingsCount: number;
  /** YYYY-MM-DD of the most recent non-cancelled booking, or null. */
  lastBookingDate: string | null;
};

const DAY_MS = 86_400_000;

/** Only Spanish is stored as a real preference; every other value means English. */
export function toLocale(language: string | null): CampaignLocale {
  return language === "es" ? "es" : "en";
}

export function conditionsMatch(
  candidate: ConditionFacts,
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
