import { whatsappTemplateEligibility } from "@/lib/campaigns/whatsapp-eligibility";
import { hasDynamicUrlButton } from "@/lib/whatsapp/templates";
import type {
  WhatsAppParamSource,
  WhatsAppTemplateRow,
} from "@/lib/whatsapp/types";
import type { CampaignLocale } from "@/types/campaign";

/**
 * Whether a template may be saved as the WhatsApp version of a message, over
 * plain values, and if not, which field to blame and which key to say.
 *
 * It asks the very rules the sender asks (`whatsappTemplateEligibility` for
 * the template and its parameters, `hasDynamicUrlButton` for a button that
 * needs a value), so what saving accepts is what sending will not skip. The
 * order is the order a person fixes things in: the template itself first, then
 * its buttons, then the parameters.
 *
 * Pure: the action reads the template, this judges it.
 */
export type WhatsAppSaveIssue = {
  field: "whatsappTemplateId" | "whatsappParams";
  /** A key under `dashboard.validation`. */
  key: "templateUnavailable" | "templateButtonValue" | "paramCountMismatch";
};

export function whatsappSaveIssue(
  template: WhatsAppTemplateRow | null | undefined,
  locale: CampaignLocale,
  sources: WhatsAppParamSource[],
): WhatsAppSaveIssue | null {
  const issue = whatsappTemplateEligibility(template, locale, sources);
  if (issue !== null && issue !== "param_count") {
    return { field: "whatsappTemplateId", key: "templateUnavailable" };
  }
  if (template && hasDynamicUrlButton(template)) {
    return { field: "whatsappTemplateId", key: "templateButtonValue" };
  }
  if (issue === "param_count") {
    return { field: "whatsappParams", key: "paramCountMismatch" };
  }
  return null;
}
