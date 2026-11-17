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
};

/** What the code guarantees about one message (see `catalog.ts`). */
export type MessageCatalogEntry = {
  key: MessageKey;
  variables: MessageVariable[];
  fixed: FixedBlock[];
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
