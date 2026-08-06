"use client";

import { useTranslations } from "next-intl";

/**
 * Resolves the message keys the public-site schemas produce.
 *
 * `parseErrors` returns whatever string the schema carried; for `signInSchema`
 * and `bookingDetailsSchema` that is a key under `common.validation`. Anything
 * else — a message from Zod's own defaults, say — passes through unchanged, so
 * an unexpected error is still readable rather than blank.
 *
 * The dashboard has its own version of this in `use-field-error`, reading the
 * namespace its own schemas point at.
 */
export function useValidationMessage(): (
  message: string | undefined,
) => string {
  const t = useTranslations("common.validation");
  return (message) => {
    if (!message) return "";
    return t.has(message) ? t(message) : message;
  };
}
