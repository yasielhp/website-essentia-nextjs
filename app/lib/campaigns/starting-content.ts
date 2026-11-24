import {
  EMPTY_LOCALE_CONTENT,
  type CampaignContent,
  type CampaignLocale,
  type CampaignLocaleContent,
} from "@/types/campaign";
import { blocksToDoc, docIsEmpty } from "./doc";
import { CAMPAIGN_LOCALES } from "./languages";
import type { CampaignTemplate } from "./templates";

/**
 * What a starting point writes into a campaign: always BOTH languages, because
 * a campaign is written in every language its audience includes and the admin
 * should not have to pick the same template twice. A version the audience ends
 * up not needing is simply not sent. Pure.
 */
export type BothVersions = Record<CampaignLocale, CampaignLocaleContent>;

/** A house template as the content of a campaign, in Spanish and in English. */
export function templateVersions(template: CampaignTemplate): BothVersions {
  const version = (locale: CampaignLocale): CampaignLocaleContent => {
    const { blocks, ...rest } = template.content[locale];
    return { ...rest, doc: blocksToDoc(blocks) };
  };
  return { es: version("es"), en: version("en") };
}

/**
 * A campaign already written, as a starting point: its two versions, copied so
 * editing the new one never touches the old. A version it never had (it was
 * written for one language) starts empty.
 */
export function previousVersions(
  content: Partial<Record<CampaignLocale, CampaignLocaleContent>>,
): BothVersions {
  const version = (locale: CampaignLocale): CampaignLocaleContent =>
    structuredClone({ ...EMPTY_LOCALE_CONTENT, ...content[locale] });
  return { es: version("es"), en: version("en") };
}

/** Whether one version has anything written in it. */
export function hasWords(block: CampaignLocaleContent | undefined): boolean {
  return (
    !!block &&
    (block.subject.trim() !== "" ||
      block.title.trim() !== "" ||
      block.preheader.trim() !== "" ||
      !docIsEmpty(block.doc))
  );
}

/** Whether a campaign has anything written in any language. */
export function anyWords(content: CampaignContent): boolean {
  return CAMPAIGN_LOCALES.some((locale) => hasWords(content[locale]));
}
