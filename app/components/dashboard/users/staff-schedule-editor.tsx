"use client";

import { useTranslations } from "next-intl";
import type { WeeklySchedule } from "@/types/schedule";

/** Monday first, which is how the week reads here — Sunday is JS day 0. */
const WEEK = ["1", "2", "3", "4", "5", "6", "0"];

/**
 * The days and hours this person works.
 *
 * Availability used to come from one hardcoded list of half-hour slots between
 * 08:00 and 19:00, the same for everybody every day. This is that list made
 * explicit and editable per person: a closed day is a day they take no
 * bookings, whatever their calendar says.
 */
export function StaffScheduleEditor({
  schedule,
  interval,
  onChange,
  onIntervalChange,
  disabled,
}: {
  schedule: WeeklySchedule;
  interval: number;
  onChange: (next: WeeklySchedule) => void;
  onIntervalChange: (minutes: number) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("dashboard.users.schedule");

  function setDay(day: string, patch: Partial<WeeklySchedule[string]>) {
    onChange({ ...schedule, [day]: { ...schedule[day]!, ...patch } });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        {WEEK.map((day) => {
          const value = schedule[day]!;
          return (
            <div
              key={day}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-2"
            >
              {/* Ids carry the day: this block is inside a map over the week,
                  so a fixed one would repeat seven times in the document. */}
              <label
                htmlFor={`schedule-${day}-open`}
                className="flex cursor-pointer items-center gap-2"
              >
                <input
                  id={`schedule-${day}-open`}
                  type="checkbox"
                  checked={value.open}
                  disabled={disabled}
                  onChange={() => setDay(day, { open: !value.open })}
                  className="accent-petroleum-700 size-4"
                />
                <span className="text-petroleum-700 text-sm">
                  {t(`days.${day}`)}
                </span>
              </label>

              <input
                id={`schedule-${day}-start`}
                aria-label={`${t(`days.${day}`)} — ${t("start")}`}
                type="time"
                value={value.start}
                disabled={disabled || !value.open}
                onChange={(e) => setDay(day, { start: e.target.value })}
                className="border-sand-200 text-petroleum-700 rounded-lg border px-2 py-1 text-sm disabled:opacity-40"
              />
              <input
                id={`schedule-${day}-end`}
                aria-label={`${t(`days.${day}`)} — ${t("end")}`}
                type="time"
                value={value.end}
                disabled={disabled || !value.open}
                onChange={(e) => setDay(day, { end: e.target.value })}
                className="border-sand-200 text-petroleum-700 rounded-lg border px-2 py-1 text-sm disabled:opacity-40"
              />
            </div>
          );
        })}
      </div>

      <div className="border-sand-100 flex items-center justify-between border-t pt-3">
        <label
          htmlFor="schedule-interval"
          className="text-petroleum-500 text-xs font-medium"
        >
          {t("interval")}
        </label>
        <select
          id="schedule-interval"
          value={interval}
          disabled={disabled}
          onChange={(e) => onIntervalChange(parseInt(e.target.value, 10))}
          className="border-sand-200 text-petroleum-700 rounded-lg border px-2 py-1 text-sm"
        >
          {[15, 30, 45, 60].map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes} min
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
