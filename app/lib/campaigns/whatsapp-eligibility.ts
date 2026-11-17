import type {
  WhatsAppParamSource,
  WhatsAppTemplateRow,
} from "@/lib/whatsapp/types";
import type { CampaignLocale } from "@/types/campaign";
import { paramsMatchTemplate } from "./whatsapp-params";

/**
 * Whether a template can go out in a campaign, over plain values.
 *
 * No database and no Meta client here, so the form (which has to offer only
 * the templates that can be sent) and the server (which checks the same thing
 * before it saves or sends) read one rule. `dispatch-whatsapp.ts` re-exports
 * `whatsappTemplateEligibility` for the send path.
 */

export type TemplateIssue =
  | "template_missing"
  | "template_not_approved"
  | "template_unsupported"
  | "template_language"
  | "param_count";

/** Why a template is not a choice at all, whatever parameters are given. */
export type TemplateChoiceIssue = Exclude<TemplateIssue, "param_count">;

const CHOICE_ISSUES: Record<TemplateChoiceIssue, true> = {
  template_missing: true,
  template_not_approved: true,
  template_unsupported: true,
  template_language: true,
};

/** Every reason a template can fail to be a choice; a new one is a type error here. */
export const TEMPLATE_CHOICE_ISSUES = Object.keys(
  CHOICE_ISSUES,
) as TemplateChoiceIssue[];

/**
 * Null when the template can be offered for a campaign written in
 * `sendLocale`; otherwise why not. Only an approved template that the
 * dashboard can fill is sendable, and it must exist in the campaign's language
 * (`es_ES` serves `es`).
 */
export function templateChoiceIssue(
  template: WhatsAppTemplateRow | null | undefined,
  sendLocale: CampaignLocale,
): TemplateChoiceIssue | null {
  if (!template) return "template_missing";
  if (template.status !== "APPROVED") return "template_not_approved";
  if (template.unsupported_reason !== null) return "template_unsupported";
  const language = template.language.toLowerCase().replace("-", "_");
  if (language !== sendLocale && !language.startsWith(`${sendLocale}_`)) {
    return "template_language";
  }
  return null;
}

/**
 * Null when the template can go out for this campaign; otherwise why not. On
 * top of the choice, the campaign must supply exactly the parameters the
 * template declares.
 */
export function whatsappTemplateEligibility(
  template: WhatsAppTemplateRow | null | undefined,
  sendLocale: CampaignLocale,
  sources: WhatsAppParamSource[],
): TemplateIssue | null {
  const issue = templateChoiceIssue(template, sendLocale);
  if (issue) return issue;
  if (paramsMatchTemplate(sources, template?.param_count ?? 0) !== null) {
    return "param_count";
  }
  return null;
}

/**
 * The field errors a save reports for a WhatsApp campaign's template, keyed
 * like the form's own validation, or null when it can go out. A parameter
 * mismatch sits on the parameters; every other reason on the template field.
 */
export function whatsappContentErrors(
  template: WhatsAppTemplateRow | null | undefined,
  sendLocale: CampaignLocale,
  sources: WhatsAppParamSource[],
): Record<string, string> | null {
  const issue = whatsappTemplateEligibility(template, sendLocale, sources);
  if (issue === null) return null;
  if (issue === "param_count") {
    return { "content.whatsapp.params": "paramCountMismatch" };
  }
  return { "content.whatsapp.templateId": "templateUnavailable" };
}
