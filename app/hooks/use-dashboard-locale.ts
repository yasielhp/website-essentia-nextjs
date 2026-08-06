"use client";

import { useLocale } from "next-intl";
import type { SupportedLocale } from "@/utils/format";

/**
 * `useLocale()` is typed as a bare string. The dashboard only ever runs on the
 * two locales in `routing.locales`, so this narrows it once instead of casting
 * at every `formatMediumDate` call site.
 */
export function useDashboardLocale(): SupportedLocale {
  return useLocale() as SupportedLocale;
}
