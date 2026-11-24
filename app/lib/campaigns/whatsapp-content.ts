import type {
  CampaignAudience,
  CampaignLocale,
  WhatsAppContent,
  WhatsAppLocaleContent,
} from "@/types/campaign";
import { CAMPAIGN_LOCALES, legacySendLocale } from "./languages";

/**
 * How the `content.whatsapp` block of a campaign is read: a template per
 * language. Pure and free of server imports, so the validation, the form and
 * the senders all read a stored campaign the same way.
 */

/** Whether a block was saved in the old shape: one template, no language. */
export function isOldWhatsAppShape(
  block: WhatsAppContent | null | undefined,
): boolean {
  if (!block) return false;
  if (block.es !== undefined || block.en !== undefined) return false;
  return block.templateId !== undefined || block.params !== undefined;
}

/**
 * The template and parameters of each language, or null where the campaign
 * has none. A block in the old shape is the template of the language that
 * campaign was sent in, and nothing for the other: an old campaign for
 * everybody still reaches the people it reached in the language it had, and
 * says the other language is missing instead of writing to them in the wrong
 * one.
 */
export function whatsappBlocks(
  block: WhatsAppContent | null | undefined,
  audience: Pick<CampaignAudience, "language" | "sendLocale">,
): Record<CampaignLocale, WhatsAppLocaleContent | null> {
  const out: Record<CampaignLocale, WhatsAppLocaleContent | null> = {
    es: null,
    en: null,
  };
  if (!block) return out;
  if (isOldWhatsAppShape(block)) {
    out[legacySendLocale(audience)] = {
      templateId: block.templateId ?? null,
      params: block.params ?? [],
    };
    return out;
  }
  for (const locale of CAMPAIGN_LOCALES) {
    const own = block[locale];
    if (own) {
      out[locale] = {
        templateId: own.templateId ?? null,
        params: own.params ?? [],
      };
    }
  }
  return out;
}

/** The block as the form writes it: the new shape, with what each language has. */
export function toWhatsAppContent(
  blocks: Record<CampaignLocale, WhatsAppLocaleContent | null>,
): WhatsAppContent {
  const out: WhatsAppContent = {};
  for (const locale of CAMPAIGN_LOCALES) {
    const own = blocks[locale];
    if (own) out[locale] = own;
  }
  return out;
}
