"use client";

import { toast } from "sonner";
import { useTranslations } from "next-intl";

/**
 * Shows an email-message action's failure as a toast. `error` is always one of
 * `MESSAGE_ACTION_ERROR_KEYS`, which the dashboard translates; a key this
 * build does not know falls back to the generic line. Nothing the mailer or
 * the database said ever comes back from the actions, so there is no detail to
 * pass on.
 */
export function useEmailActionToast() {
  const t = useTranslations("dashboard.messages.email.errors");
  return (failure: { error: string }) => {
    toast.error(t.has(failure.error) ? t(failure.error) : t("generic"));
  };
}
