"use client";

import { useTranslations } from "next-intl";

/** The audience could not be counted: said as such, never as "nobody". */
export function ReachFailed({
  onRetry,
  message,
  notReady = false,
}: {
  onRetry: () => void;
  /** The server is not set up yet: said so, with no retry, which would change nothing. */
  notReady?: boolean;
  /** Already in words; the audience one when absent. */
  message?: string;
}) {
  const t = useTranslations("dashboard.campaigns.audience");
  if (notReady) {
    return (
      <p role="alert" className="text-xs font-medium text-red-600">
        {t("reachNotReady")}
      </p>
    );
  }
  return (
    <p role="alert" className="text-xs font-medium text-red-600">
      {message ?? t("reachFailed")}{" "}
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex min-h-11 items-center underline underline-offset-2"
      >
        {t("reachRetry")}
      </button>
    </p>
  );
}
