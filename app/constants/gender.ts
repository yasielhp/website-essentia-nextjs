import type { SelectOption } from "@/components/ui/option-select";
import type { Gender } from "@/types/person";

/** Value used by the selects when nothing has been chosen. */
export const GENDER_UNSPECIFIED = "";

/** What a gender select offers, including the empty "not specified" entry. */
export type GenderValue = Gender | typeof GENDER_UNSPECIFIED;

/**
 * Dashboard labels. The staff dashboard is English-only; the public booking
 * flow is bilingual and takes its labels from the `booking` message namespace
 * instead of this list.
 */
export const GENDER_OPTIONS: SelectOption<GenderValue>[] = [
  { value: "", label: "Not specified" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
];

/** Label for display in tables and detail views. */
export function genderLabel(gender: string | null | undefined): string {
  if (!gender) return "—";
  return GENDER_OPTIONS.find((o) => o.value === gender)?.label ?? "—";
}

/** Normalises a select value into what the database stores. */
export function toStoredGender(value: GenderValue): Gender | null {
  return value === GENDER_UNSPECIFIED ? null : value;
}
