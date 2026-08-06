import type { Gender } from "@/types/person";

/** Value used by the selects when nothing has been chosen. */
export const GENDER_UNSPECIFIED = "";

/** What a gender select offers, including the empty "not specified" entry. */
export type GenderValue = Gender | typeof GENDER_UNSPECIFIED;

/**
 * The stored values, in the order the selects show them.
 *
 * The wording lives in `dashboard.gender.*` and is applied by the
 * `useGenderOptions` hook — this list stays free of copy so the schema, the
 * database and the selects agree on the values themselves. The public booking
 * flow takes its own labels from the `booking` message namespace.
 */
export const GENDER_VALUES: GenderValue[] = [
  GENDER_UNSPECIFIED,
  "female",
  "male",
  "other",
];

/** Normalises a select value into what the database stores. */
export function toStoredGender(value: GenderValue): Gender | null {
  return value === GENDER_UNSPECIFIED ? null : value;
}
