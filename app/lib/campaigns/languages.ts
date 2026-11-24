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
 * What a send, a schedule or an activation answers for a campaign that fails
 * its validation: WHICH version is missing when that is what is wrong (the
 * dashboard has a sentence for each), else the plain "check the fields".
 */
export function incompleteError(
  errors: Record<string, string>,
): "missing_es" | "missing_en" | "missing_both" | "invalid" {
  const missing = missingLocales(errors);
  if (missing.length === 0) return "invalid";
  if (missing.length > 1) return "missing_both";
  return missing[0] === "es" ? "missing_es" : "missing_en";
}
