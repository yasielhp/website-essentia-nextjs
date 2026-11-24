import type {
  CampaignAudience,
  CampaignLanguage,
  CampaignLocale,
} from "@/types/campaign";
import { toLocale } from "./conditions";

/**
 * Which languages a campaign is written in, and which one each person gets.
 *
 * A campaign is written in every language its audience includes, and each
 * contact receives the version of HER language. Pure and free of server
 * imports: the form, the validation and the senders read the same rule.
 */

/** Spanish first: the house order, and the order of the tabs. */
export const CAMPAIGN_LOCALES: readonly CampaignLocale[] = ["es", "en"];

/**
 * The languages a campaign goes out in, and so the versions it must have: the
 * one its audience fixes, or both when the audience spans the two.
 *
 * Decided by the audience's language condition and nothing else, not by who is
 * in it today: an automation mails whoever qualifies later, in whatever
 * language she has, and a rule that read today's list would let one go without
 * her version.
 */
export function audienceLocales(audience: {
  language: CampaignLanguage;
}): CampaignLocale[] {
  return audience.language === "any"
    ? [...CAMPAIGN_LOCALES]
    : [audience.language];
}

/**
 * The language ONE recipient is written to in: her own when the campaign has
 * both versions; the audience's when it fixes one, whoever she is (a contact
 * added by hand to a Spanish segment has no English version to get).
 *
 * `own` is the contact's `preferred_language` as stored, or the language a row
 * was queued with. Read by `toLocale`, the rule the language filter and the
 * counts by language already use: only Spanish is Spanish, anything else
 * (English, nothing, a value nobody expected) reads as English.
 */
export function recipientLocale(
  audience: Pick<CampaignAudience, "language">,
  own: string | null | undefined,
): CampaignLocale {
  return audience.language === "any"
    ? toLocale(own ?? null)
    : audience.language;
}

/**
 * The language a campaign was sent in when a campaign had ONE: the audience's
 * when it fixes one, else the choice it stored (`sendLocale`), else Spanish,
 * the house default.
 *
 * It decides nothing about who gets what any more (`recipientLocale` does).
 * It is only how a row saved in the old shape is read: its lone WhatsApp
 * template was the template of this language.
 */
export function legacySendLocale(
  audience: Pick<CampaignAudience, "language" | "sendLocale">,
): CampaignLocale {
  if (audience.language !== "any") return audience.language;
  return audience.sendLocale ?? "es";
}

/**
 * The languages a validation left incomplete, read off its error keys
 * (`content.en.subject`, `content.whatsapp.es.templateId`…), so a refusal can
 * say WHICH version is missing instead of "something is wrong".
 */
export function missingLocales(
  errors: Record<string, string>,
): CampaignLocale[] {
  const keys = Object.keys(errors);
  return CAMPAIGN_LOCALES.filter((locale) =>
    keys.some(
      (key) =>
        key.startsWith(`content.${locale}.`) ||
        key.startsWith(`content.whatsapp.${locale}.`),
    ),
  );
}

/**
 * The message keys that say a field was left empty, as opposed to filled in
 * wrong (too long, a link that is not https…). A version with one of them is
 * missing; a version with only the others is there, with errors.
 */
const EMPTY_FIELD_CODES: ReadonlySet<string> = new Set([
  "subjectRequired",
  "subjectBRequired",
  "titleRequired",
  "bodyRequired",
  "templateRequired",
]);

/** What a refusal can say about the versions, from `incompleteError`. */
export const INCOMPLETE_ERRORS = [
  "missing_es",
  "missing_en",
  "missing_both",
  "errors_es",
  "errors_en",
  "errors_both",
  "missing_es_errors_en",
  "missing_en_errors_es",
  "invalid",
] as const;

export type IncompleteError = (typeof INCOMPLETE_ERRORS)[number];

/**
 * What a send, a schedule or an activation answers for a campaign that fails
 * its validation: WHICH version is wrong and HOW (the dashboard has a sentence
 * for each), else the plain "check the fields". A version is missing when a
 * field it needs was left empty; it has errors when everything is written but
 * something is wrong (a subject too long, say), which "missing" would misstate.
 */
export function incompleteError(
  errors: Record<string, string>,
): IncompleteError {
  const state = (locale: CampaignLocale): "missing" | "errors" | null => {
    const own = Object.entries(errors).filter(
      ([key]) =>
        key.startsWith(`content.${locale}.`) ||
        key.startsWith(`content.whatsapp.${locale}.`),
    );
    if (own.length === 0) return null;
    return own.some(([, code]) => EMPTY_FIELD_CODES.has(code))
      ? "missing"
      : "errors";
  };
  const es = state("es");
  const en = state("en");
  if (es === null && en === null) return "invalid";
  if (es === en) return es === "missing" ? "missing_both" : "errors_both";
  if (en === null) return es === "missing" ? "missing_es" : "errors_es";
  if (es === null) return en === "missing" ? "missing_en" : "errors_en";
  return es === "missing" ? "missing_es_errors_en" : "missing_en_errors_es";
}
