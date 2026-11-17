import type { TemplateSend } from "@/lib/whatsapp/client";
import { toCampaignPhone } from "@/lib/whatsapp/phone";
import type { WhatsAppTemplateRow } from "@/lib/whatsapp/types";
import type { CampaignLocale } from "@/types/campaign";
import {
  templateChoiceIssue,
  type TemplateChoiceIssue,
} from "./whatsapp-eligibility";
import { resolveParams } from "./whatsapp-params";

export type TestSendPlan =
  | { ok: true; to: string; send: TemplateSend }
  | {
      ok: false;
      error: "no_phone" | "template_unavailable";
      /** Only for `template_unavailable`: why. */
      detail?: TemplateChoiceIssue;
    };

/**
 * What "send me a test" sends: the chosen template, with the example values it
 * was submitted with, to the number on the admin's own profile.
 *
 * The number comes from the caller's profile and never from the browser, so
 * the button cannot be used to message somebody else. The template is held to
 * the same rule as a real send (approved, supported, in the campaign's
 * language), because a test that works where the send would not is a lie. A
 * missing example becomes a dash, which is what Meta accepts for an empty
 * parameter.
 */
export function prepareTestSend(
  template: WhatsAppTemplateRow | null | undefined,
  sendLocale: CampaignLocale,
  profilePhone: string | null | undefined,
): TestSendPlan {
  const to = toCampaignPhone(profilePhone);
  if (!to) return { ok: false, error: "no_phone" };

  const issue = templateChoiceIssue(template, sendLocale);
  if (issue || !template) {
    return {
      ok: false,
      error: "template_unavailable",
      detail: issue ?? "template_missing",
    };
  }

  const examples = Array.isArray(template.example_params)
    ? template.example_params
    : [];
  const bodyParams = resolveParams(
    Array.from({ length: template.param_count }, (_, i) => ({
      kind: "static" as const,
      value: examples[i] as string,
    })),
    { id: "test", email: null, firstName: "", language: sendLocale },
  );
  return {
    ok: true,
    to,
    send: {
      to,
      name: template.name,
      language: template.language,
      bodyParams,
    },
  };
}
