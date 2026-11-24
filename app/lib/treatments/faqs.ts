import type { FaqItem } from "@/components/sections/service-faq";
import type { ServiceFaqEntry } from "@/data/service-faqs";

/** The translator of the page's language, as `getTranslations` gives it. */
type Translate = ((key: string) => string) & { has: (key: string) => boolean };

/**
 * The questions of a service page in the page's language, as the page shows
 * them AND as its FAQPage schema says them: one list, so the two cannot differ.
 *
 * An answer that names a treatment hidden from the site (its session type
 * switched off, `hidden` from `listHiddenTreatments`) is the one written
 * without it (`answerWithout`), so the page never names what it has no page
 * for; it names it again by itself once the session type is switched back on.
 * The variant drops every treatment the answer names, so with one of two back
 * on the answer still leaves both out until the other is: an omission, never a
 * treatment that cannot be booked. A question with no such variant is left out
 * rather than shown naming it. Pure: the translator is handed in.
 */
export function shownFaqs(
  slug: string,
  entries: readonly ServiceFaqEntry[],
  hidden: readonly string[],
  t: Translate,
): FaqItem[] {
  return entries.flatMap((entry, i) => {
    const key = `${slug}.${i}`;
    const names = entry.mentions?.some((id) => hidden.includes(id)) ?? false;
    if (!names) {
      return [{ question: t(`${key}.question`), answer: t(`${key}.answer`) }];
    }
    if (!t.has(`${key}.answerWithout`)) return [];
    return [
      { question: t(`${key}.question`), answer: t(`${key}.answerWithout`) },
    ];
  });
}
