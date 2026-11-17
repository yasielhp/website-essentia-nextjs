/** The `id` of the validation message under a field, for `aria-describedby`. */
export const fieldErrorId = (id: string): string => `${id}-error`;

/**
 * What a screen reader needs to hear about a field: that it is required, that
 * it is wrong, and where the reason is written. The red asterisk and the red
 * border say the same to the eye and nothing to anyone else. Only the
 * attributes that apply are returned, so an optional field with no error gets
 * none (an `aria-invalid="false"` on every input is noise).
 */
export function fieldAria({
  id,
  required,
  error,
}: {
  id: string;
  required?: boolean;
  error?: string;
}): {
  "aria-required"?: true;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
} {
  return {
    ...(required ? { "aria-required": true as const } : {}),
    ...(error
      ? { "aria-invalid": true as const, "aria-describedby": fieldErrorId(id) }
      : {}),
  };
}
