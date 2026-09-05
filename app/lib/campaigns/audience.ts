import { getAdminClient } from "@/lib/insforge-admin";
import type { CampaignAudience } from "@/types/campaign";
import {
  filterAudience,
  type ContactCandidate,
  type Recipient,
} from "./audience-filter";

/**
 * Resolves a campaign audience against the live tables.
 *
 * Two plain reads and an in-memory filter, not a query built from the
 * conditions: the centre has a few hundred contacts and bookings, so pulling
 * both tables costs less than one round trip per condition, the SDK has no
 * dynamic SQL to express "any of these services" or "last booking older
 * than", and every rule lives in `audience-filter.ts` where it is tested. If
 * the tables ever outgrow this, the same signature can sit over an RPC that
 * does the fold in Postgres.
 *
 * SERVER ONLY: reads through the admin client.
 */

type ContactRow = {
  id: string;
  email: string;
  first_name: string | null;
  preferred_language: string | null;
  newsletter_subscribed: boolean | null;
  email_bounced_at: string | null;
};

type BookingRow = {
  contact_id: string;
  service_id: string | null;
  /** Nullable in the live table: some imported rows carry no date. */
  date: string | null;
};

type BookingSummary = {
  last: string | null;
  services: Set<string>;
  count: number;
};

/** Rows above what the centre could plausibly hold; only a guard, not paging. */
const MAX_ROWS = 9_999;

export async function resolveAudience(
  audience: CampaignAudience,
  now = new Date(),
): Promise<Recipient[]> {
  const db = getAdminClient().database;

  const [contactsResult, bookingsResult] = await Promise.all([
    db
      .from("contacts")
      .select(
        "id, email, first_name, preferred_language, newsletter_subscribed, email_bounced_at",
      )
      .not("email", "is", null)
      .range(0, MAX_ROWS),
    db
      .from("bookings")
      .select("contact_id, service_id, date")
      .neq("status", "cancelled")
      .not("contact_id", "is", null)
      .range(0, MAX_ROWS),
  ]);

  if (contactsResult.error) {
    throw new Error(
      `[resolveAudience] contacts read failed: ${contactsResult.error.message}`,
    );
  }
  if (bookingsResult.error) {
    throw new Error(
      `[resolveAudience] bookings read failed: ${bookingsResult.error.message}`,
    );
  }

  // One pass over bookings, keyed by contact: the latest date, the set of
  // services ever booked, and how many bookings count towards "never booked".
  const byContact = new Map<string, BookingSummary>();
  for (const booking of (bookingsResult.data ?? []) as BookingRow[]) {
    const summary = byContact.get(booking.contact_id) ?? {
      last: null,
      services: new Set<string>(),
      count: 0,
    };
    // A booking without a date still proves the contact booked, and which
    // service, but cannot be "the last one". `date` is a Postgres date, but
    // sliced anyway so a timestamp would still compare as YYYY-MM-DD, which
    // sorts lexically as it does chronologically.
    if (booking.date) {
      const day = booking.date.slice(0, 10);
      if (summary.last === null || day > summary.last) summary.last = day;
    }
    if (booking.service_id) summary.services.add(booking.service_id);
    summary.count += 1;
    byContact.set(booking.contact_id, summary);
  }

  const candidates: ContactCandidate[] = (
    (contactsResult.data ?? []) as ContactRow[]
  ).map((row) => {
    const bookings = byContact.get(row.id);
    return {
      id: row.id,
      email: row.email,
      firstName: row.first_name ?? "",
      language: row.preferred_language,
      newsletter: row.newsletter_subscribed === true,
      bouncedAt: row.email_bounced_at,
      lastBookingDate: bookings?.last ?? null,
      serviceIds: bookings ? [...bookings.services] : [],
      bookingsCount: bookings?.count ?? 0,
    };
  });

  return filterAudience(candidates, audience, now);
}
