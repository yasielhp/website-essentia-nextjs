"use client";

import { useTranslations } from "next-intl";
import type { SelectOption } from "@/components/ui/option-select";
import type { GenderValue } from "@/constants/gender";
import { GENDER_VALUES } from "@/constants/gender";

/**
 * The gender select's options, translated.
 *
 * `GENDER_VALUES` stays a plain constant so the schema and the database keep
 * one source of truth for the stored values; only the wording comes from
 * `dashboard.gender.*`.
 */
export function useGenderOptions(): SelectOption<GenderValue>[] {
  const t = useTranslations("dashboard.gender");
  return GENDER_VALUES.map((value) => ({
    value,
    label: t(value === "" ? "unspecified" : value),
  }));
}
