import { blocksToDoc } from "@/lib/campaigns/doc";
import type {
  CampaignLocale,
  CampaignLocaleContent,
  EmailDoc,
} from "@/types/campaign";

/**
 * The text of a default, in the two halves the legacy email prints: `intro` is
 * what it prints before its blocks and `outro` the closing sentence it prints
 * after them.
 */
export type MessageDefaultText = Omit<CampaignLocaleContent, "doc"> & {
  /**
   * The small line in capitals ABOVE the title ("Booking confirmed"), as plain
   * text with `{{variables}}`; null for a message whose email has none. It is
   * not part of `intro`.
   */
  kicker: string | null;
  intro: EmailDoc;
  outro: EmailDoc | null;
};

/**
 * A default as the editor opens it: the text and `doc`, the WHOLE email as a
 * document (its kicker and title, the text and every block the message has, placed where the
 * legacy email prints them). `defaultContent` builds `doc` from the text.
 */
export type MessageDefault = MessageDefaultText & { doc: EmailDoc };

/** One message's default text, in both languages. */
export type MessageDefaults = Record<CampaignLocale, MessageDefaultText>;

/** The text of a default with its closing sentence. */
export function withOutro(
  base: Omit<MessageDefaultText, "outro">,
  outro: EmailDoc | null,
): MessageDefaultText {
  return { ...base, outro };
}

/**
 * A default: the subject, the preheader, the kicker (the line above the title,
 * or null) and the title as plain text with `{{variables}}`, and the body as
 * paragraphs, split into what comes before the fixed blocks and what comes
 * after.
 *
 * The text is copied from the legacy template it stands for, sentence by
 * sentence (`docs/plans/2026-11-17-message-inventory.md`), and a test checks
 * it against the HTML that template really produces, in the same order. These
 * defaults are what the editor shows and what "reset" restores. With a saved
 * row that has no body of its own they are also the body, around the fixed
 * blocks; with nothing saved, the legacy template itself goes out.
 */
export function content(
  subject: string,
  preheader: string,
  kicker: string | null,
  title: string,
  intro: string[],
  outro: string[] = [],
): MessageDefaultText {
  const toDoc = (paragraphs: string[]) =>
    blocksToDoc(paragraphs.map((text) => ({ type: "paragraph", text })));
  return withOutro(
    { subject, preheader, kicker, title, intro: toDoc(intro) },
    outro.length > 0 ? toDoc(outro) : null,
  );
}
