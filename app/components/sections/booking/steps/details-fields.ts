import type { DetailsState } from "@/types";

/**
 * The controls of the details step that can be in error, with the `id` each one
 * carries, in the order the form shows them. One list, so the markup and the
 * "take me to my mistake" focus cannot disagree.
 */
export const DETAILS_FIELD_ID = {
  firstName: "first-name",
  lastName: "last-name",
  email: "email",
  phone: "phone",
  consent: "booking-consent",
} as const satisfies Partial<Record<keyof DetailsState, string>>;

type ValidatedField = keyof typeof DETAILS_FIELD_ID;

/**
 * The `id` of the first control in error, top to bottom, or null when there is
 * none. Pressing "next" with something wrong moves the focus there, so nobody
 * is left looking for what stopped them.
 */
export function firstInvalidFieldId(
  errors: Partial<Record<keyof DetailsState, string>>,
): string | null {
  const first = (Object.keys(DETAILS_FIELD_ID) as ValidatedField[]).find(
    (key) => Boolean(errors[key]),
  );
  return first ? DETAILS_FIELD_ID[first] : null;
}
