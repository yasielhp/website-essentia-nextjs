import type { CampaignLocale } from "@/types/campaign";

/**
 * The preview the server last drew, with the language it is of. Pure, for the
 * preview and its test.
 */
export type RenderedPreview = { locale: CampaignLocale; html: string } | null;

/**
 * The HTML to show for the language on screen, or null ("loading") while the
 * preview of that language has not arrived. A preview of the other language
 * is never shown: after a switch of language the old one would otherwise stay
 * on screen, under the new version's fields, until the new one is drawn.
 */
export function shownPreview(
  rendered: RenderedPreview,
  locale: CampaignLocale,
): string | null {
  return rendered && rendered.locale === locale ? rendered.html : null;
}
