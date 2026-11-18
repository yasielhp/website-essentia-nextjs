import type { WhatsAppParamSource } from "@/lib/whatsapp/types";
import type { CampaignLocale, EmailDoc } from "@/types/campaign";
import type { FixedBlock, MessageKey, MessageVariable } from "./catalog";

/**
 * What `listMessageTemplates` hands the browser. Everything here is plain JSON
 * (no dates, no class instances), so it crosses the server boundary as it is.
 * Types only: Server Action modules must not re-export them.
 */

/** A saved version of one message, one channel, one language. */
export type MessageTemplateRowView = {
  key: MessageKey;
  channel: "email" | "whatsapp";
  locale: CampaignLocale;
  enabled: boolean;
  subject: string | null;
  preheader: string | null;
  title: string | null;
  doc: EmailDoc | null;
  whatsapp_template_id: string | null;
  whatsapp_params: WhatsAppParamSource[];
  updated_at: string;
  /** Who saved it, by name; null when unknown (or the profile is gone). */
  updated_by_name?: string | null;
  /**
   * The saved body was not a document: `doc` is null and the editor should say
   * so instead of showing an empty message as if it were the admin's.
   */
  corrupt?: boolean;
};

/** What the code guarantees about one message (see `catalog.ts`). */
export type MessageCatalogEntry = {
  key: MessageKey;
  variables: MessageVariable[];
  fixed: FixedBlock[];
  /** The blocks (of `fixed`) the email prints after its closing sentence. */
  afterClosing: FixedBlock[];
  canDisable: boolean;
  whatsappEligible: boolean;
};

/**
 * The text the editor opens with when nothing is saved, and what "reset"
 * restores. `doc` is the whole body (intro and closing together).
 */
export type MessageDefaultEntry = {
  key: MessageKey;
  locale: CampaignLocale;
  subject: string;
  preheader: string;
  title: string;
  doc: EmailDoc;
};

/**
 * The `error` keys the actions in `app/actions/message-templates.ts` answer
 * with, besides the auth ones. The dashboard translates each under
 * `dashboard.messages.email.errors`; a test keeps this list and the
 * translations together.
 */
export const MESSAGE_ACTION_ERROR_KEYS = [
  "unauthenticated",
  "forbidden",
  "db",
  "invalid",
  "no_email",
  "no_phone",
  "email_failed",
  "email_not_configured",
  "test_rate_limited",
  "preview_rate_limited",
  "template_unavailable",
  "whatsapp_not_configured",
  "meta",
] as const;
