import { blocksToDoc } from "@/lib/campaigns/doc";
import type {
  CampaignLocale,
  CampaignLocaleContent,
  EmailDoc,
} from "@/types/campaign";

/**
 * A default as the editor opens it, plus the two halves of its body.
 *
 * `intro` is what the legacy email prints before its fixed blocks and `outro`
 * the closing sentence it prints after them. `doc` is both together, which is
 * what the editor shows: an admin who edits the body replaces the whole thing,
 * closing included.
 */
export type MessageDefault = CampaignLocaleContent & {
  intro: EmailDoc;
  outro: EmailDoc | null;
};

/** One message's default text, in both languages. */
export type MessageDefaults = Record<CampaignLocale, MessageDefault>;

/** Joins an intro and an outro into the one document the editor opens. */
export function withOutro(
  base: Omit<MessageDefault, "doc" | "outro">,
  outro: EmailDoc | null,
): MessageDefault {
  return {
    ...base,
    outro,
    doc: {
      type: "doc",
      content: [...(base.intro.content ?? []), ...(outro?.content ?? [])],
    },
  };
}

/**
 * A default: the subject, the preheader and the title as plain text with
 * `{{variables}}`, and the body as paragraphs, split into what comes before
 * the fixed blocks and what comes after.
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
  title: string,
  intro: string[],
  outro: string[] = [],
): MessageDefault {
  const toDoc = (paragraphs: string[]) =>
    blocksToDoc(paragraphs.map((text) => ({ type: "paragraph", text })));
  return withOutro(
    { subject, preheader, title, intro: toDoc(intro) },
    outro.length > 0 ? toDoc(outro) : null,
  );
}
