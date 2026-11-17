"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * A read that failed, said as such with a way to try again: never an empty list,
 * a "not found" or a zero, which would read as an answer.
 */
export function LoadFailed({
  onRetry,
  message,
  className = "px-6 py-20",
}: {
  onRetry: () => void;
  /** Already in words; the generic line when absent. */
  message?: string;
  className?: string;
}) {
  const t = useTranslations("dashboard.common");
  return (
    <div
      className={`flex flex-col items-center gap-4 text-center ${className}`}
    >
      <p role="alert" className="text-petroleum-400 text-sm">
        {message ?? t("loadFailed")}
      </p>
      <Button variant="outline" onClick={onRetry}>
        {t("retry")}
      </Button>
    </div>
  );
}
