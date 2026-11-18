"use client";

import { toast } from "sonner";
import { useTranslations } from "next-intl";

type ActionFailure = { error: string; detail?: string };

/**
 * Shows an action's failure as a toast.
 *
 * `error` is always one of our keys, so it is translated; a key this build does
 * not know (an `AuthError` message, say) falls back to the generic line rather
 * than printing English. What Meta or the network said travels in `detail` and
 * is shown as it came. `afterSubmit` is for the create call: a timeout or an
 * error from Meta may still have created the template, so the toast says how to
 * find out.
 */
export function useActionToast() {
  const t = useTranslations("dashboard.messages.whatsapp");

  return (failure: ActionFailure, options?: { afterSubmit?: boolean }) => {
    const key = `errors.${failure.error}`;
    const title = t.has(key) ? t(key) : t("errors.generic");
    const maybeCreated =
      options?.afterSubmit &&
      (failure.error === "meta" || failure.error === "submittedNotSaved");
    const description = [
      failure.error === "meta" ? failure.detail : null,
      maybeCreated ? t("toasts.syncHint") : null,
    ]
      .filter(Boolean)
      .join(" ");
    toast.error(title, description ? { description } : undefined);
  };
}
