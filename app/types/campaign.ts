/** Email campaigns, as the dashboard and its actions read them. */

/**
 * `scheduled` waits for the cron; `sending` is claimed by a dispatch in
 * progress; `failed` means the dispatch itself broke, not that a recipient
 * bounced — those are counted on the row instead.
 */
export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "cancelled"
  | "failed"
  /** An automated campaign the cron evaluates on every run. */
  | "active"
  /** An automated campaign switched off, keeping its history. */
  | "paused";

/**
 * What kind of campaign this is. `standard` and `split` go out once;
 * the rest stay active and mail whoever newly qualifies.
 */
export type CampaignKind =
  "standard" | "automated" | "autoresponder" | "split" | "rss" | "dateBased";

export type TriggerEvent =
  | "newsletter_subscribed"
  | "segment_entry"
  | "after_booking"
  | "birthday"
  | "first_booking_anniversary"
  | "new_blog_post";

/** The kind's settings. Flat and optional so every kind shares one column. */
export type CampaignTrigger = {
  event?: TriggerEvent;
  /** `after_booking`: how many days after the booking the email goes out. */
  days?: number;
};

/** The event each kind runs on when it has no choice to make. */
export const DEFAULT_TRIGGER: Record<CampaignKind, CampaignTrigger> = {
  standard: {},
  split: {},
  autoresponder: { event: "newsletter_subscribed" },
  automated: { event: "segment_entry" },
  dateBased: { event: "birthday" },
  rss: { event: "new_blog_post" },
};

export const AUTOMATED_KINDS: CampaignKind[] = [
  "automated",
  "autoresponder",
  "rss",
  "dateBased",
];

export function isAutomatedKind(kind: CampaignKind): boolean {
  return AUTOMATED_KINDS.includes(kind);
}

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
  /** Only people with at least one booking. Optional: older rows never had it. */
  hasBooked?: boolean;
  /**
   * The one language the email is written in. Fixed by the segment when it
   * selects a language; chosen by the admin when the segment spans both.
   */
  sendLocale?: CampaignLocale;
  /** Contacts added by hand, unioned with the filter result. */
  manualIds: string[];
};

/** One language's version of the email. Every field empty = not sent in it. */
/** The conditions half of an audience: what a saved segment stores. */
export type SegmentConditions = Omit<
  CampaignAudience,
  "manualIds" | "sendLocale"
>;

/** A named set of conditions, kept for the next campaign. */
export type CampaignSegment = {
  id: string;
  name: string;
  conditions: SegmentConditions;
  created_at: string;
  updated_at: string;
};

/** What the segment picker shows: each saved segment with how many it reaches today. */
export type SegmentList = {
  everyone: number;
  segments: (CampaignSegment & { count: number })[];
};

/**
 * One piece of the email body. The admin stacks these in order; the template
 * turns each into email-safe HTML. Paragraph text keeps the three inline
 * constructs (`**bold**`, `[text](https://…)`, `{{first_name}}`).
 */
export type ContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "image"; url: string; alt: string }
  | { type: "button"; text: string; url: string }
  | { type: "divider" };

export type ContentBlockType = ContentBlock["type"];

export type CampaignLocaleContent = {
  subject: string;
  /** A/B test only: the subject half the audience sees instead. */
  subjectB?: string;
  preheader: string;
  title: string;
  blocks: ContentBlock[];
};

/** The `content` jsonb column. */
export type CampaignContent = Record<CampaignLocale, CampaignLocaleContent>;

export type CampaignRow = {
  id: string;
  name: string;
  status: CampaignStatus;
  kind: CampaignKind;
  trigger: CampaignTrigger;
  activated_at: string | null;
  last_run_at: string | null;
  audience: CampaignAudience;
  content: CampaignContent;
  /** The segment the conditions came from, if any; the conditions are still copied. */
  segment_id: string | null;
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
  /** "" for one-shot sends; the year, the post id… for repeating rules. */
  cycle: string;
  variant: "a" | "b" | null;
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
  blocks: [],
};

export const EMPTY_AUDIENCE: CampaignAudience = {
  language: "any",
  newsletter: null,
  services: [],
  lastBooking: null,
  neverBooked: false,
  hasBooked: false,
  manualIds: [],
};

/** The three numbers on top of the campaign list. */
export type CampaignStats = {
  sentThisMonth: number;
  recipients: number;
  delivered: number;
  opened: number;
};

/** One campaign as seen from a contact's page. */
export type ContactCampaignRow = {
  id: string;
  status: RecipientStatus;
  sent_at: string | null;
  campaign: { id: string; name: string; sent_at: string | null } | null;
};

/** A hit in the manual-recipient picker. */
export type ContactSearchHit = {
  id: string;
  name: string;
  email: string;
  language: CampaignLocale;
};

/** What `saveCampaign` takes: the form as one value. */
export type CampaignInput = {
  id?: string | null;
  segmentId?: string | null;
  kind: CampaignKind;
  trigger: CampaignTrigger;
  name: string;
  audience: CampaignAudience;
  content: CampaignContent;
};
