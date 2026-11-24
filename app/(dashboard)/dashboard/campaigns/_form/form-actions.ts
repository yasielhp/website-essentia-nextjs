import {
  incompleteError,
  type IncompleteError,
} from "@/lib/campaigns/languages";
import { counterpartTemplate, fitParams } from "@/lib/campaigns/whatsapp-form";
import { validateCampaign } from "@/lib/schemas";
import type {
  WhatsAppParamSource,
  WhatsAppTemplateRow,
} from "@/lib/whatsapp/types";
import type {
  CampaignAudience,
  CampaignContent,
  CampaignKind,
  CampaignLocale,
  WhatsAppLocaleContent,
} from "@/types/campaign";
import {
  contentOf,
  firstErroredLocale,
  type FormAction,
  type FormState,
} from "./form-state";

/**
 * What the campaign form decides, as plain functions over its state. The
 * form's handlers call these and only dispatch, toast and talk to the server
 * with the answer; the tests call the same functions.
 */

/**
 * What "send me a test" is given: the version on screen, and only that one.
 * An email sends the email of `activeLocale`; a WhatsApp campaign the template
 * of that language, judged against the audience it is for.
 */
export type TestRequest =
  | { channel: "email"; content: CampaignContent; locale: CampaignLocale }
  | {
      channel: "whatsapp";
      content: CampaignContent;
      audience: CampaignAudience;
      locale: CampaignLocale;
    };

export function testRequest(state: FormState): TestRequest {
  return state.channel === "whatsapp"
    ? {
        channel: "whatsapp",
        content: contentOf(state),
        audience: state.audience,
        locale: state.activeLocale,
      }
    : { channel: "email", content: state.content, locale: state.activeLocale };
}

/**
 * What the "confirm" of the content step leads to, for `state` as it is once
 * the editor's last words are in it:
 *
 * - `done`: the step is finished (an error outside the content, the name
 *   say, is the review's to show).
 * - `show`: a version has something missing or wrong; it comes on screen and
 *   the toast names it (`toast`, a key under `errors`).
 * - `stay`: a WhatsApp campaign without its template stays on the step.
 *
 * `errors` is what the fields show, when the check refused.
 */
export type ContentVerdict =
  | { kind: "done"; errors: Record<string, string> | null }
  | {
      kind: "show";
      errors: Record<string, string>;
      locale: CampaignLocale;
      toast: IncompleteError;
    }
  | { kind: "stay"; errors: Record<string, string> };

export function contentVerdict(state: FormState): ContentVerdict {
  const check = validateCampaign({
    name: state.name,
    channel: state.channel,
    kind: state.kind,
    trigger: state.trigger,
    audience: state.audience,
    content: contentOf(state),
  });
  if (check.ok) return { kind: "done", errors: null };
  const { errors } = check;
  // With two languages the error may be on the one not on screen.
  const locale = firstErroredLocale(errors, state.activeLocale);
  if (locale) {
    return { kind: "show", errors, locale, toast: incompleteError(errors) };
  }
  if (Object.keys(errors).some((key) => key.startsWith("content.whatsapp"))) {
    return { kind: "stay", errors };
  }
  return { kind: "done", errors };
}

/**
 * The language to bring on screen after the server refused a save with field
 * errors: the one on screen when it has an error of its own, else the first
 * that has one, else none (the error is nobody's language). And whether the
 * content step must open again: a WhatsApp template is fixed there.
 */
export function serverErrorFocus(
  fieldErrors: Record<string, string>,
  activeLocale: CampaignLocale,
): { locale: CampaignLocale | null; reopenContent: boolean } {
  return {
    locale: firstErroredLocale(fieldErrors, activeLocale),
    reopenContent: Object.keys(fieldErrors).some((key) =>
      key.startsWith("content.whatsapp"),
    ),
  };
}

/** A translator of `dashboard.campaigns`, as `useTranslations` gives it. */
export type CampaignsTranslator = {
  (key: string, values?: Record<string, string>): string;
  has: (key: string) => boolean;
};

/**
 * A refusal of an action in the admin's words. A template that cannot go out
 * says which language's template it is; any other code has its sentence under
 * `errors`, or the generic one.
 */
export function refusalText(
  t: CampaignsTranslator,
  failure: { error?: string; locale?: unknown },
): string {
  const code = failure.error ?? "generic";
  if (
    code === "template_unavailable" &&
    (failure.locale === "es" || failure.locale === "en")
  ) {
    return t("errors.template_unavailable_in", {
      language: t(
        failure.locale === "es" ? "content.localeEs" : "content.localeEn",
      ),
    });
  }
  return t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.generic");
}

/**
 * Picking a template for the language on screen: the writes it makes, each
 * naming the language it is for, and the language a template was proposed
 * for. The template of the same name in each other language that has none
 * yet is proposed too (Meta keeps each language as a template apart, usually
 * under one name), with its own parameters still to set; a language that
 * already has one keeps it.
 */
export function pickTemplate(input: {
  all: WhatsAppTemplateRow[];
  picked: WhatsAppTemplateRow;
  locale: CampaignLocale;
  locales: readonly CampaignLocale[];
  blocks: Record<CampaignLocale, WhatsAppLocaleContent | null>;
  params: WhatsAppParamSource[];
  kind: CampaignKind;
}): {
  actions: FormAction[];
  proposed: { locale: CampaignLocale; name: string } | null;
} {
  const { all, picked, locale, locales, blocks, params, kind } = input;
  const actions: FormAction[] = [
    {
      type: "SET_WHATSAPP",
      locale,
      templateId: picked.id,
      params: fitParams(params, picked.param_count),
    },
  ];
  let proposed: { locale: CampaignLocale; name: string } | null = null;
  for (const other of locales) {
    if (other === locale || blocks[other]?.templateId) continue;
    const pair = counterpartTemplate(all, picked, other, kind);
    if (!pair) continue;
    actions.push({
      type: "SET_WHATSAPP",
      locale: other,
      templateId: pair.id,
      params: fitParams([], pair.param_count),
    });
    proposed = { locale: other, name: pair.name };
  }
  return { actions, proposed };
}
