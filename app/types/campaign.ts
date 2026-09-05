/** Email campaigns, as the dashboard and its actions read them. */

/**
 * `scheduled` waits for the cron; `sending` is claimed by a dispatch in
 * progress; `failed` means the dispatch itself broke, not that a recipient
 * bounced — those are counted on the row instead.
 */
export type CampaignStatus =
  "draft" | "scheduled" | "sending" | "sent" | "cancelled" | "failed";

/**
 * Advances in this order: `queued` → `sent` → `delivered` → `opened` →
 * `clicked`. `bounced` and `complained` are terminal, and `failed` is ours
 * (Resend never accepted the message).
 */
export type RecipientStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "failed";

/** The two languages an email can go out in. */
export type CampaignLocale = "en" | "es";

/** The language filter of a campaign; `any` sends each contact their own. */
export type CampaignLanguage = CampaignLocale | "any";

/** The `audience` jsonb column: conditions plus hand-picked contacts. */
export type CampaignAudience = {
  language: CampaignLanguage;
  /** `true` restricts to subscribers; `null` means anybody. */
  newsletter: boolean | null;
  /** `bookableServices` ids; empty means no service condition. */
  services: string[];
  /** "Last booking more/less than N days ago"; `null` means no condition. */
  lastBooking: { op: "gt" | "lt"; days: number } | null;
  neverBooked: boolean;
  /** Contacts added by hand, unioned with the filter result. */
  manualIds: string[];
};

/** One language's version of the email. Every field empty = not sent in it. */
export type CampaignLocaleContent = {
  subject: string;
  preheader: string;
  title: string;
  body: string;
  imageUrl: string;
  ctaText: string;
  ctaUrl: string;
};

/** The `content` jsonb column. */
export type CampaignContent = Record<CampaignLocale, CampaignLocaleContent>;

export type CampaignRow = {
  id: string;
  name: string;
  status: CampaignStatus;
  audience: CampaignAudience;
  content: CampaignContent;
  scheduled_at: string | null;
  sent_at: string | null;
  /** When a dispatch claimed the row; the cron uses it to spot a stuck send. */
  sending_started_at: string | null;
  created_at: string;
  updated_at: string;
  recipients_count: number;
  delivered_count: number;
  opened_count: number;
  clicked_count: number;
  bounced_count: number;
  complained_count: number;
  failed_count: number;
  last_error: string | null;
};

/** A frozen recipient of a sent campaign, as the webhook keeps it. */
export type CampaignRecipientRow = {
  id: string;
  contact_id: string | null;
  email: string;
  language: CampaignLocale;
  status: RecipientStatus;
  error: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
};

/** What the dashboard shows while the admin adjusts the conditions. */
export type AudiencePreview = {
  count: number;
  byLanguage: { en: number; es: number };
  sample: {
    id: string;
    name: string;
    email: string;
    language: CampaignLocale;
  }[];
};

export const EMPTY_LOCALE_CONTENT: CampaignLocaleContent = {
  subject: "",
  preheader: "",
  title: "",
  body: "",
  imageUrl: "",
  ctaText: "",
  ctaUrl: "",
};

export const EMPTY_AUDIENCE: CampaignAudience = {
  language: "any",
  newsletter: null,
  services: [],
  lastBooking: null,
  neverBooked: false,
  manualIds: [],
};
