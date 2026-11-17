"use client";

import { useTranslations } from "next-intl";

/** The audience could not be counted: said as such, never as "nobody". */
export function ReachFailed({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("dashboard.campaigns.audience");
  return (
    <p role="alert" className="text-xs font-medium text-red-600">
      {t("reachFailed")}{" "}
      <button
        type="button"
        onClick={onRetry}
        className="underline underline-offset-2"
      >
        {t("reachRetry")}
      </button>
    </p>
  );
}
