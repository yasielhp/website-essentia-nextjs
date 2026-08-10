"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

export function CompletedRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit: () => void;
}) {
  const t = useTranslations("dashboard.bookings.form");
  return (
    <div className="border-sand-200 flex items-center gap-4 rounded-2xl border bg-white px-5 py-4">
      <div className="bg-sand-100 flex size-8 shrink-0 items-center justify-center rounded-lg">
        <Check size={14} className="text-petroleum-500" />
      </div>
      <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
        <p className="text-petroleum-400 text-xs">{label}</p>
        <p className="text-petroleum-700 truncate text-sm font-medium">
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="text-petroleum-400 hover:text-petroleum-700 shrink-0 text-xs transition-colors"
      >
        {t("change")}
      </button>
    </div>
  );
}
