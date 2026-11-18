import {
  templateChoiceIssue,
  whatsappTemplateEligibility,
  type TemplateChoiceIssue,
  type TemplateIssue,
} from "@/lib/campaigns/whatsapp-eligibility";
import type { CampaignLocale } from "@/types/campaign";
import type {
  WhatsAppParamField,
  WhatsAppParamSource,
  WhatsAppTemplateRow,
} from "@/lib/whatsapp/types";
import { hasDynamicUrlButton } from "@/lib/whatsapp/templates";
import { MESSAGE_CATALOG, MESSAGE_KEYS, type MessageKey } from "./catalog";
import { allowedParamFields } from "./param-fields";

/**
 * What the Emails tab decides about a message's WhatsApp row, over plain
 * values: which messages have one, which templates it may use, and what to say
 * about the one it has. Pure, and light enough for the browser (the validator
 * and the renderer are not imported).
 */

/** The messages that may also go out on WhatsApp: the ones the booking line promises (confirmation and reminder). */
export const WHATSAPP_MESSAGE_KEYS: MessageKey[] = MESSAGE_KEYS.filter(
  (key) => MESSAGE_CATALOG[key].whatsappEligible,
);

/** The contact fields a message's WhatsApp parameters can read from. */
export function messageParamFields(key: MessageKey): WhatsAppParamField[] {
  return allowedParamFields(key);
}

// The rule lives with the templates (`hasDynamicUrlButton`); this screen and the
// save of a row read the same one.
export { hasDynamicUrlButton };

export type MessageTemplateChoices = {
  eligible: WhatsAppTemplateRow[];
  /** Why the others are not offered, by the first reason that rules each out. */
  excluded: Partial<Record<TemplateChoiceIssue, number>>;
  /** Of the otherwise sendable ones, how many were left out for a variable link. */
  dynamicUrl: number;
};

/** The templates a message may be given in this language. */
export function messageTemplateChoices(
  templates: WhatsAppTemplateRow[],
  locale: CampaignLocale,
): MessageTemplateChoices {
  const eligible: WhatsAppTemplateRow[] = [];
  const excluded: MessageTemplateChoices["excluded"] = {};
  let dynamicUrl = 0;
  for (const template of templates) {
    const issue = templateChoiceIssue(template, locale);
    if (issue) {
      excluded[issue] = (excluded[issue] ?? 0) + 1;
    } else if (hasDynamicUrlButton(template)) {
      dynamicUrl += 1;
    } else {
      eligible.push(template);
    }
  }
  return { eligible, excluded, dynamicUrl };
}

export type WhatsAppRowState =
  /** Nothing saved, or no template chosen: nothing is sent. */
  | { kind: "none" }
  | { kind: "configured"; templateName: string }
  | { kind: "invalid"; issue: TemplateIssue | "dynamic_url" }
  /** The templates could not be read, so the saved one cannot be judged. */
  | { kind: "unknown" };

/** The saved part of a WhatsApp row that decides what is shown. */
export type SavedWhatsAppRow = {
  enabled: boolean;
  whatsapp_template_id: string | null;
  whatsapp_params: WhatsAppParamSource[];
};

export function whatsappRowState(
  saved: SavedWhatsAppRow | undefined,
  templates: WhatsAppTemplateRow[] | null,
  locale: CampaignLocale,
): WhatsAppRowState {
  if (!saved || !saved.whatsapp_template_id) return { kind: "none" };
  // The switch is not the status: a row switched off is still read as what it
  // is set up as, and the list shows the switch beside it.
  if (templates === null) return { kind: "unknown" };
  const template = templates.find((t) => t.id === saved.whatsapp_template_id);
  const issue = whatsappTemplateEligibility(
    template,
    locale,
    saved.whatsapp_params,
  );
  if (issue) return { kind: "invalid", issue };
  if (template && hasDynamicUrlButton(template)) {
    return { kind: "invalid", issue: "dynamic_url" };
  }
  return { kind: "configured", templateName: template?.name ?? "" };
}
