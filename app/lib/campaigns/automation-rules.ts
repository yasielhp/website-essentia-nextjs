import type { CampaignTrigger } from "@/types/campaign";
import type { Recipient } from "./audience-filter";

/**
 * Which recipients an automated campaign owes an email to today, and under
 * which cycle key. Pure: the runner loads the segment and the posts, this
 * decides, the runner inserts and sends. The unique index on
 * (campaign_id, email, cycle) makes every decision idempotent — asking twice
 * on the same day inserts nothing new.
 */

export type Due = {
  recipient: Recipient;
  /** "" for once-ever rules; a year, a date or a post id for repeating ones. */
  cycle: string;
  vars?: Record<string, string>;
};

export type BlogPostSummary = {
  id: string;
  publishedAt: string;
  title: Record<"en" | "es", string>;
  excerpt: Record<"en" | "es", string>;
  url: Record<"en" | "es", string>;
};

/** YYYY-MM-DD in Atlantic/Canary, where the centre and its clients live. */
export function localDay(now: Date): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Atlantic/Canary" });
}

const DAY_MS = 86_400_000;

function addDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  return new Date(d.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** "MM-DD" of a YYYY-MM-DD, for once-a-year matches. */
const monthDay = (day: string) => day.slice(5, 10);

export function dueRecipients({
  trigger,
  recipients,
  activatedAt,
  now,
  posts = [],
}: {
  trigger: CampaignTrigger;
  /** The campaign's segment, resolved now. */
  recipients: Recipient[];
  activatedAt: string;
  now: Date;
  /** Published blog posts, for `new_blog_post`. */
  posts?: BlogPostSummary[];
}): Due[] {
  const today = localDay(now);
  const year = today.slice(0, 4);

  switch (trigger.event) {
    // Once, to whoever is in the segment. New entrants are picked up on the
    // next run; the cycle "" keeps everybody at one email ever.
    case "segment_entry":
      return recipients.map((recipient) => ({ recipient, cycle: "" }));

    // Whoever subscribed since the campaign went live. Older subscribers are
    // not greeted late: a welcome three months on reads as a mistake.
    case "newsletter_subscribed":
      return recipients
        .filter((r) => r.subscribedAt && r.subscribedAt >= activatedAt)
        .map((recipient) => ({ recipient, cycle: "" }));

    // N days after the most recent booking. Keyed by that booking's date, so
    // a client who comes back next month is written to again for that visit.
    case "after_booking": {
      const days = trigger.days ?? 0;
      return recipients
        .filter(
          (r) =>
            r.lastBookingDate && addDays(r.lastBookingDate, days) === today,
        )
        .map((recipient) => ({
          recipient,
          cycle: recipient.lastBookingDate ?? "",
        }));
    }

    case "birthday":
      return recipients
        .filter((r) => r.birthdate && monthDay(r.birthdate) === monthDay(today))
        .map((recipient) => ({ recipient, cycle: year }));

    // The anniversary of the first visit, from the second year on.
    case "first_booking_anniversary":
      return recipients
        .filter(
          (r) =>
            r.firstBookingDate &&
            monthDay(r.firstBookingDate) === monthDay(today) &&
            r.firstBookingDate.slice(0, 4) < year,
        )
        .map((recipient) => ({ recipient, cycle: year }));

    // One email per post published since activation, to the whole segment,
    // carrying the post's title, excerpt and link in the recipient's language.
    case "new_blog_post":
      return posts
        .filter((post) => post.publishedAt >= activatedAt)
        .flatMap((post) =>
          recipients.map((recipient) => ({
            recipient,
            cycle: post.id,
            vars: {
              post_title: post.title[recipient.language],
              post_excerpt: post.excerpt[recipient.language],
              post_url: post.url[recipient.language],
            },
          })),
        );

    default:
      return [];
  }
}
