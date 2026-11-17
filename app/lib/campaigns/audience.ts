import { getAdminClient } from "@/lib/insforge-admin";
import type { CampaignAudience, CampaignChannel } from "@/types/campaign";
import { visitEndsAtIso } from "./visit-time";
import {
  filterAudience,
  type ContactCandidate,
  type Recipient,
  type VisitInfo,
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
 * Bookings are matched to contacts by `contact_id` and, failing that, by
 * email: bookings created from the dashboard never set a `contact_id` (81 of
 * the first 100 rows carried none), so keying on it alone would call most
 * clients "never booked".
 *
 * SERVER ONLY: reads through the admin client.
 */

type ContactRow = {
  id: string;
  /** Nullable in the live table: a WhatsApp-only contact has none. */
  email: string | null;
  first_name: string | null;
  preferred_language: string | null;
  newsletter_subscribed: boolean | null;
  email_bounced_at: string | null;
  newsletter_unsubscribed_at: string | null;
  newsletter_subscribed_at: string | null;
  birthdate: string | null;
  last_name: string | null;
  phone: string | null;
  whatsapp_marketing_opted_in_at: string | null;
  whatsapp_opted_out_at: string | null;
  whatsapp_unreachable_at: string | null;
};

type BookingRow = {
  contact_id: string | null;
  email: string | null;
  service_id: string | null;
  service_title: string | null;
  tier_id: string | null;
  /** Nullable in the live table: some imported rows carry no date. */
  date: string | null;
  time: string | null;
  duration: string | null;
  status: string | null;
};

type BookingSummary = {
  last: string | null;
  first: string | null;
  services: Set<string>;
  count: number;
  /** ISO end of the earliest confirmed/completed visit. */
  firstVisitEndsAt: string | null;
  /** The same, per session type. */
  firstVisitEndsAtByTier: Map<string, string>;
  confirmedCount: number;
  /** The latest booking by date then time, and its sort key. */
  lastVisit: VisitInfo | null;
  lastVisitKey: string;
  /** Alongside `firstVisitEndsAt`: the booking that earliest end belongs to. */
  firstVisit: VisitInfo | null;
  firstVisitByTier: Map<string, VisitInfo>;
};

/** Rows above what the centre could plausibly hold; only a guard, not paging. */
const MAX_ROWS = 9_999;

export async function resolveAudience(
  audience: CampaignAudience,
  now = new Date(),
  channel: CampaignChannel = "email",
): Promise<Recipient[]> {
  return filterAudience(await loadCandidates(channel), audience, now, channel);
}

/**
 * Every contact with its booking history folded in, ready for the filter.
 * Separate from `resolveAudience` so a screen that counts several segments
 * at once reads the tables once, not once per segment.
 *
 * The channel only decides which contacts can possibly qualify: the email
 * channel needs an address, WhatsApp needs a phone and may have no email.
 */
export async function loadCandidates(
  channel: CampaignChannel = "email",
): Promise<ContactCandidate[]> {
  const db = getAdminClient().database;

  const [contactsResult, bookingsResult, tiersResult] = await Promise.all([
    db
      .from("contacts")
      .select(
        "id, email, first_name, last_name, phone, preferred_language, newsletter_subscribed, email_bounced_at, newsletter_unsubscribed_at, newsletter_subscribed_at, birthdate, whatsapp_marketing_opted_in_at, whatsapp_opted_out_at, whatsapp_unreachable_at",
      )
      .not(channel === "whatsapp" ? "phone" : "email", "is", null)
      // A fixed order, so the contact kept when two share a phone (the first)
      // is the same in the preview and in the send.
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(0, MAX_ROWS),
    db
      .from("bookings")
      .select(
        "contact_id, email, service_id, service_title, tier_id, date, time, duration, status",
      )
      .neq("status", "cancelled")
      .range(0, MAX_ROWS),
    // A handful of rows: read apart rather than embedded, so it does not
    // depend on the foreign key being declared.
    db.from("service_tiers").select("id, label"),
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

  // A label is a nicety for the message: if the read failed, the booking
  // still goes out without it.
  const tierLabels = new Map<string, string>();
  for (const tier of (tiersResult.data ?? []) as {
    id: string;
    label: string | null;
  }[]) {
    if (tier.label) tierLabels.set(tier.id, tier.label);
  }

  const contacts = (contactsResult.data ?? []) as ContactRow[];

  // Contact emails are stored lowercased; booking emails are typed by hand,
  // so the booking side is normalised before the lookup.
  const contactIdByEmail = new Map<string, string>();
  for (const row of contacts) {
    if (!row.email) continue;
    const email = row.email.trim().toLowerCase();
    if (!contactIdByEmail.has(email)) contactIdByEmail.set(email, row.id);
  }

  // One pass over bookings, keyed by contact: the latest date, the set of
  // services ever booked, and how many bookings count towards "never booked".
  // Each booking resolves to at most one contact, so a row carrying both a
  // matching id and email is counted once.
  const byContact = new Map<string, BookingSummary>();
  for (const booking of (bookingsResult.data ?? []) as BookingRow[]) {
    const contactId =
      booking.contact_id ??
      (booking.email
        ? contactIdByEmail.get(booking.email.trim().toLowerCase())
        : undefined);
    if (!contactId) continue;

    const summary = byContact.get(contactId) ?? {
      last: null,
      first: null,
      services: new Set<string>(),
      count: 0,
      firstVisitEndsAt: null,
      firstVisitEndsAtByTier: new Map<string, string>(),
      confirmedCount: 0,
      lastVisit: null,
      lastVisitKey: "",
      firstVisit: null,
      firstVisitByTier: new Map<string, VisitInfo>(),
    };
    const visit: VisitInfo | null = booking.date
      ? {
          service: booking.service_title ?? "",
          sessionType: booking.tier_id
            ? (tierLabels.get(booking.tier_id) ?? null)
            : null,
          date: booking.date.slice(0, 10),
          time: (booking.time ?? "").slice(0, 5),
        }
      : null;
    // A booking without a date still proves the contact booked, and which
    // service, but cannot be "the last one". `date` is a Postgres date, but
    // sliced anyway so a timestamp would still compare as YYYY-MM-DD, which
    // sorts lexically as it does chronologically.
    if (booking.date) {
      const day = booking.date.slice(0, 10);
      if (summary.last === null || day > summary.last) summary.last = day;
      if (summary.first === null || day < summary.first) summary.first = day;
      // The latest by date, then by time: two bookings on the same day are
      // told apart by the later one. Same set as `last` (non-cancelled).
      const key = `${day} ${(booking.time ?? "").slice(0, 5)}`;
      if (visit && key > summary.lastVisitKey) {
        summary.lastVisitKey = key;
        summary.lastVisit = visit;
      }
    }
    // Only visits that really happened (or will) start the post-visit flow;
    // the earliest end wins, compared as ISO strings in the same base (UTC).
    if (booking.status === "confirmed" || booking.status === "completed") {
      summary.confirmedCount += 1;
      const endsAt = visitEndsAtIso(
        booking.date,
        booking.time,
        booking.duration,
      );
      if (
        endsAt &&
        (summary.firstVisitEndsAt === null || endsAt < summary.firstVisitEndsAt)
      ) {
        summary.firstVisitEndsAt = endsAt;
        // The booking that earliest end belongs to, so the message talks
        // about the visit the rule is waiting for.
        summary.firstVisit = visit;
      }
      // And the earliest of this session type, so a campaign for one type is
      // not decided by what the client booked first of another.
      if (endsAt && booking.tier_id) {
        const earlier = summary.firstVisitEndsAtByTier.get(booking.tier_id);
        if (earlier === undefined || endsAt < earlier) {
          summary.firstVisitEndsAtByTier.set(booking.tier_id, endsAt);
          if (visit) summary.firstVisitByTier.set(booking.tier_id, visit);
        }
      }
    }
    if (booking.service_id) summary.services.add(booking.service_id);
    summary.count += 1;
    byContact.set(contactId, summary);
  }

  const candidates: ContactCandidate[] = contacts.map((row) => {
    const bookings = byContact.get(row.id);
    return {
      id: row.id,
      email: row.email ?? "",
      firstName: row.first_name ?? "",
      language: row.preferred_language,
      newsletter: row.newsletter_subscribed === true,
      bouncedAt: row.email_bounced_at,
      unsubscribedAt: row.newsletter_unsubscribed_at,
      lastBookingDate: bookings?.last ?? null,
      firstBookingDate: bookings?.first ?? null,
      subscribedAt: row.newsletter_subscribed_at,
      birthdate: row.birthdate,
      lastName: row.last_name,
      phone: row.phone,
      serviceIds: bookings ? [...bookings.services] : [],
      bookingsCount: bookings?.count ?? 0,
      firstVisitEndsAt: bookings?.firstVisitEndsAt ?? null,
      firstVisitEndsAtByTier: bookings
        ? Object.fromEntries(bookings.firstVisitEndsAtByTier)
        : {},
      confirmedBookingsCount: bookings?.confirmedCount ?? 0,
      lastVisit: bookings?.lastVisit ?? null,
      firstVisit: bookings?.firstVisit ?? null,
      firstVisitByTier: bookings
        ? Object.fromEntries(bookings.firstVisitByTier)
        : {},
      whatsappMarketingOptedInAt: row.whatsapp_marketing_opted_in_at,
      whatsappOptedOutAt: row.whatsapp_opted_out_at,
      whatsappUnreachableAt: row.whatsapp_unreachable_at,
    };
  });

  return candidates;
}
