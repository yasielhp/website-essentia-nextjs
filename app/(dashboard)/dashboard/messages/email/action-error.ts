"use client";

import { toast } from "sonner";
import { useTranslations } from "next-intl";

/**
 * Shows an email-message action's failure as a toast. `error` is always one of
 * `MESSAGE_ACTION_ERROR_KEYS`, which the dashboard translates; a key this
 * build does not know falls back to the generic line. Nothing the mailer or
 * the database said ever comes back from the actions; `detail` is only what is
 * safe to show.
 */
export function useEmailActionToast() {
  const t = useTranslations("dashboard.messages.email.errors");
  const tIssue = useTranslations("dashboard.messages.email.whatsapp.issue");
  return (failure: { error: string; detail?: string }) => {
    const title = t.has(failure.error) ? t(failure.error) : t("generic");
    // Two answers carry a reason that is safe to show: Meta's own words about
    // the template or the account, and the code of why a template cannot be
    // sent, which is put in words here.
    const description =
      failure.error === "meta"
        ? failure.detail
        : failure.error === "template_unavailable" && failure.detail
          ? tIssue.has(failure.detail)
            ? tIssue(failure.detail)
            : undefined
          : undefined;
    toast.error(title, description ? { description } : undefined);
  };
}
