/** Campaigns, as the dashboard and its actions read them. */

import type { WhatsAppParamSource } from "@/lib/whatsapp/types";

/** Where a campaign goes out. One channel per campaign. */
export type CampaignChannel = "email" | "whatsapp";

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
  | "standard"
  | "automated"
  | "autoresponder"
  | "split"
  | "rss"
  | "dateBased"
  /**
   * WhatsApp only: a notice to a client about her own booking, N hours before
   * it or after it. Automated, and TRANSACTIONAL: it needs the consent to
   * appointment notices, not the one to news and offers.
   */
  | "appointment";

export type TriggerEvent =
  | "newsletter_subscribed"
  | "segment_entry"
  | "after_booking"
  | "birthday"
  | "first_booking_anniversary"
  | "new_blog_post"
  | "first_visit"
  /** `appointment`: N hours before each confirmed booking starts. */
  | "before_visit"
  /** `appointment`: N hours after each booking ends. */
  | "after_visit";

/** The kind's settings. Flat and optional so every kind shares one column. */
export type CampaignTrigger = {
  event?: TriggerEvent;
  /** `after_booking`: how many days after the booking the email goes out. */
  days?: number;
  /**
   * `first_visit`: hours after the first confirmed visit ends (0-168).
   * `before_visit`: hours before a booking starts (1-336).
   * `after_visit`: hours after a booking ends (1-720).
   */
  hours?: number;
  /**
   * `first_visit`: only the first visit of this session type counts (a
   * `service_tiers` id). Absent, the first visit of any type does.
   */
  tierId?: string;
};

/** The event each kind runs on when it has no choice to make. */
export const DEFAULT_TRIGGER: Record<CampaignKind, CampaignTrigger> = {
  standard: {},
  split: {},
  autoresponder: { event: "newsletter_subscribed" },
  automated: { event: "segment_entry" },
  dateBased: { event: "birthday" },
  rss: { event: "new_blog_post" },
  appointment: { event: "before_visit", hours: 24 },
};

export const AUTOMATED_KINDS: CampaignKind[] = [
  "automated",
  "autoresponder",
  "rss",
  "dateBased",
  "appointment",
];

export function isAutomatedKind(kind: CampaignKind): boolean {
  return AUTOMATED_KINDS.includes(kind);
}

/**
 * Which consent a WhatsApp campaign needs. A notice about the client's own
 * appointment is transactional (the box that promises "the confirmation and
 * the reminder of my appointment"); everything else is marketing (the box for
 * news and offers). The two are separate consents and neither stands in for
 * the other.
 */
export type ConsentPurpose = "marketing" | "appointment";

export function consentPurposeOf(kind: CampaignKind): ConsentPurpose {
  return kind === "appointment" ? "appointment" : "marketing";
}

/**
 * Advances in this order: `queued` → (`sending` →) `sent` → `delivered` → `opened` →
 * `clicked`. `bounced` and `complained` are terminal, and `failed` is ours
 * (Resend never accepted the message).
 */
export type RecipientStatus =
  | "queued"
  /** WhatsApp: claimed by a sender and, perhaps, already sent. */
  | "sending"
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
  /**
   * A hand-made list: the audience is `manualIds` and nobody else, whatever the
   * conditions say (they are only how the people were found). The fixed
   * exclusions (no address, unsubscribed, bounced; consent, STOP, unreachable
   * and the STOP list on WhatsApp) apply to the list as to everyone.
   */
  manualOnly?: boolean;
};

/** One language's version of the email. Every field empty = not sent in it. */
/** The conditions half of an audience: what a saved segment stores. */
export type SegmentConditions = Omit<
  CampaignAudience,
  "manualIds" | "manualOnly" | "sendLocale"
> & {
  /**
   * A segment is of one of two kinds. Without these two it is a saved FILTER
   * (dynamic: whoever meets the conditions, today or later). With a list it is
   * a hand-made LIST (fixed: only the people picked, whether or not they meet
   * any condition; the conditions are stored at their neutral value).
   */
  manualIds?: string[];
  manualOnly?: true;
};

/** A named set of conditions, kept for the next campaign. */
export type CampaignSegment = {
  id: string;
  name: string;
  conditions: SegmentConditions;
  created_at: string;
  updated_at: string;
};

/** A past campaign's words, offered as a starting point for a new one. */
export type CampaignContentSummary = {
  id: string;
  name: string;
  kind: CampaignKind;
  sent_at: string | null;
  content: CampaignContent;
};

/** One person in a segment, as the segment page lists them. */
export type SegmentMember = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  language: CampaignLocale;
  newsletter: boolean;
};

/**
 * One person on the screen where a segment is made: everyone with an email or a
 * phone, with what the filters read and what already keeps a channel from
 * reaching her. The reasons are the ones that block a channel whatever the
 * campaign is (consent depends on what it is for, so it is not here).
 */
export type SegmentPerson = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  phone: string | null;
  /** As stored; only Spanish is Spanish, anything else reads as English. */
  language: string | null;
  newsletter: boolean;
  serviceIds: string[];
  bookingsCount: number;
  lastBookingDate: string | null;
  /** Why an email would not reach her, or null. */
  emailIssue: "unsubscribed" | "bounced" | null;
  /** Why a WhatsApp message would not reach her, or null. */
  whatsappIssue: "stopped" | "unreachable" | null;
};

/** What the segment picker shows: each saved segment with how many it reaches today. */
export type SegmentList = {
  /**
   * The read failed (the session, the database, the counts): what is here is
   * not the segments, and a screen must say so instead of showing "none" or "0".
   */
  failed?: true;
  everyone: number;
  segments: (CampaignSegment & {
    count: number;
    /**
     * A list only: how many of the people picked are still contacts a segment can
     * hold (the page of the list counts the same). The stored ids may include
     * somebody deleted since.
     */
    picked?: number;
  })[];
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

/**
 * A Tiptap/Maily document node. The body of a campaign is one of these with
 * `type: "doc"`; the editor produces it and the renderer consumes it.
 */
export type EmailDoc = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: EmailDoc[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
};

export type CampaignLocaleContent = {
  subject: string;
  /** A/B test only: the subject half the audience sees instead. */
  subjectB?: string;
  preheader: string;
  title: string;
  /** The body, as the Maily editor left it. Null until something is written. */
  doc: EmailDoc | null;
};

/** The `content.whatsapp` block: which approved template and what fills it. */
export type WhatsAppContent = {
  /** `whatsapp_templates.id`; null until the admin picks one. */
  templateId: string | null;
  /** One source per `{{n}}`, in order. */
  params: WhatsAppParamSource[];
};

/**
 * The `content` jsonb column. The language blocks are the email; `whatsapp`
 * is the template of a WhatsApp campaign and is absent from older rows.
 */
export type CampaignContent = Record<CampaignLocale, CampaignLocaleContent> & {
  whatsapp?: WhatsAppContent;
};

export type CampaignRow = {
  id: string;
  name: string;
  status: CampaignStatus;
  channel: CampaignChannel;
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
  /**
   * Only on the rows `listCampaigns` returns, and only for a WhatsApp campaign
   * that is not finished: how many messages really left, counted from its
   * recipient rows.
   */
  sent_count?: number;
};

/** A frozen recipient of a sent campaign, as the webhook keeps it. */
export type CampaignRecipientRow = {
  id: string;
  contact_id: string | null;
  /** The contact's name, read with the row (the contact may be gone: then none). */
  contact_name?: string | null;
  /** Null on a WhatsApp row: the address is the phone. */
  email: string | null;
  /** E.164; null on an email row. */
  phone: string | null;
  language: CampaignLocale;
  status: RecipientStatus;
  /** "" for one-shot sends; the year, the post id… for repeating rules. */
  cycle: string;
  variant: "a" | "b" | null;
  error: string | null;
  /**
   * What the rule stored for this row: for an appointment notice, the
   * appointment it is about (service, date, time). Null for most rows.
   */
  vars: Record<string, unknown> | null;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  /** WhatsApp only: when the contact read the message. */
  read_at: string | null;
};

/** What the dashboard shows while the admin adjusts the conditions. */
export type AudiencePreview = {
  count: number;
  byLanguage: { en: number; es: number };
  sample: {
    id: string;
    name: string;
    /** Empty for a WhatsApp recipient, whose address is the phone. */
    email: string;
    phone?: string | null;
    language: CampaignLocale;
  }[];
};

export const EMPTY_LOCALE_CONTENT: CampaignLocaleContent = {
  subject: "",
  preheader: "",
  title: "",
  doc: null,
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

/** How many campaigns sit in each state; the cards on top of the list. */
export type CampaignStatusCounts = Record<CampaignStatus | "all", number>;

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
  /** The campaign's channel; the row's status reads differently on each. */
  channel: CampaignChannel;
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
  channel: CampaignChannel;
  kind: CampaignKind;
  trigger: CampaignTrigger;
  name: string;
  audience: CampaignAudience;
  content: CampaignContent;
};
