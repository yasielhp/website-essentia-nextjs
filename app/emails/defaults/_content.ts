import { blocksToDoc } from "@/lib/campaigns/doc";
import type { CampaignLocale, CampaignLocaleContent } from "@/types/campaign";

/** One message's default text, in both languages. */
export type MessageDefaults = Record<CampaignLocale, CampaignLocaleContent>;

/**
 * A default as the editor opens it: the subject, the preheader and the title
 * as plain text with `{{variables}}`, and the body as paragraphs.
 *
 * The text is copied from the legacy template it stands for, sentence by
 * sentence (`docs/plans/2026-11-17-message-inventory.md`), and a test checks
 * it against the HTML that template really produces. These defaults are what
 * the editor shows and what "reset" restores; they are never what goes out
 * when the admin has not edited anything.
 */
export function content(
  subject: string,
  preheader: string,
  title: string,
  paragraphs: string[],
): CampaignLocaleContent {
  return {
    subject,
    preheader,
    title,
    doc: blocksToDoc(paragraphs.map((text) => ({ type: "paragraph", text }))),
  };
}
