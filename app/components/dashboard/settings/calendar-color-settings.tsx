"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ColorRow } from "@/components/dashboard/settings/color-row";
import { loadColorSettings, saveColorSettings } from "@/utils/color-settings";

/**
 * The colour a section paints with on the overview calendar.
 *
 * Races and education used to keep this behind an "Ajustes" button on their
 * own list pages, which put two settings dialogs somewhere nobody looked for
 * settings. Same control, now where the rest of them are.
 *
 * The value lives in localStorage, so it is per browser rather than per
 * account — changing it here does not change what a colleague sees.
 */
export function CalendarColorSettings({
  field,
}: {
  field: "races" | "sessions";
}) {
  const t = useTranslations("dashboard");
  const [color, setColor] = useState<string | null>(null);

  useEffect(() => {
    setColor(loadColorSettings()[field]);
  }, [field]);

  function update(next: string) {
    setColor(next);
    saveColorSettings({ ...loadColorSettings(), [field]: next });
  }

  const label =
    field === "races" ? t("races.colorLabel") : t("education.colorLabel");

  return (
    <div>
      {color === null ? (
        <div className="bg-sand-100 h-12 animate-pulse rounded-xl" />
      ) : (
        <ColorRow label={label} value={color} onChange={update} />
      )}
      <p className="text-petroleum-400 mt-4 text-xs leading-relaxed">
        {t("settings.colorHint")}
      </p>
    </div>
  );
}
