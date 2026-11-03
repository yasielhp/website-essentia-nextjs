import type { SupportedLocale } from "@/utils/format";

/**
 * The two languages a bilingual record is written in, in the order the tabs
 * show them: the dashboard's own language first, so somebody working in
 * Spanish lands on the Spanish fields and does not switch every time.
 */
export function langTabs(locale: SupportedLocale): readonly SupportedLocale[] {
  return locale === "es" ? ["es", "en"] : ["en", "es"];
}
