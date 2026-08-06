"use client";

import { useTranslations } from "next-intl";

/**
 * Resolves the message keys the dashboard people schemas produce.
 *
 * `parseErrors` hands back whatever string the schema carried; for the
 * dashboard schemas that is a key under `dashboard.validation`. Anything else
 * — a message from Zod's own defaults, say — is passed through unchanged so an
 * unexpected error is still readable rather than blank.
 */
export function useFieldError(): (message: string | undefined) => string {
  const t = useTranslations("dashboard.validation");
  return (message) => {
    if (!message) return "";
    return t.has(message) ? t(message) : message;
  };
}
