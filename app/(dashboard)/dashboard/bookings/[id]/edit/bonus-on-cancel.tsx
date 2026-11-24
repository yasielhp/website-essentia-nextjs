"use client";

import { useTranslations } from "next-intl";
import { isOutsideCancellationWindow } from "@/lib/bookings/cancellation-window";

/**
 * What cancelling a session drawn from a bonus does with it, said before
 * saving. At least 24 hours before it goes back to the bonus, and the screen
 * says so. Inside the last 24 hours it is lost (Terms 3.4), and the team
 * decides: the box «Devolver la sesión al bono» starts unticked, and is ticked
 * when it is the centre that cancels.
 */
export function BonusOnCancel({
  date,
  time,
  seenAt,
  returnLate,
  onChange,
  disabled,
}: {
  /** The session as it was saved, not as the form may have moved it. */
  date: string | null;
  time: string;
  /** When "Cancelada" was chosen: the 24 hours are judged at that moment. */
  seenAt: number;
  returnLate: boolean;
  onChange: (value: boolean) => void;
  disabled: boolean;
}) {
  const t = useTranslations("dashboard.bookings.edit.bonus");

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
      {isOutsideCancellationWindow(date, time, seenAt) ? (
        <p className="text-petroleum-700 text-sm">{t("inAdvance")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <label
            htmlFor="bonus-return-late"
            className="flex cursor-pointer items-center gap-2"
          >
            <input
              id="bonus-return-late"
              type="checkbox"
              checked={returnLate}
              disabled={disabled}
              onChange={() => onChange(!returnLate)}
              className="accent-petroleum-700 size-4"
            />
            <span className="text-petroleum-700 text-sm font-medium">
              {t("lateLabel")}
            </span>
          </label>
          <p className="text-petroleum-500 text-xs">{t("lateHelp")}</p>
        </div>
      )}
    </div>
  );
}
