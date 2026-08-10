"use client";

import { useMemo, useState } from "react";
import { useMonthFreeBusy, useDayFreeBusy } from "@/hooks/use-free-busy";
import {
  getCalendarDays,
  getTimeSlotsForDashboard,
  isAvailableDay,
} from "@/utils/calendar-helpers";
import { localDateStr } from "@/utils/format";

/**
 * Which month the calendar shows, and what is already taken in it.
 *
 * The month lives here rather than inside the calendar because the answer to
 * "which days are full" has to be fetched for the month on show, and only
 * whoever holds the month can ask.
 */
export function useCalendarMonth({
  serviceId,
  serviceCategory,
  durationMinutes,
  selectedDate,
}: {
  serviceId: string;
  serviceCategory: string | undefined;
  durationMinutes: number;
  selectedDate: Date | null;
}) {
  const [view, setView] = useState(() => {
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() };
  });

  const prevMonth = () => {
    setView((prev) =>
      prev.month === 0
        ? { year: prev.year - 1, month: 11 }
        : { year: prev.year, month: prev.month - 1 },
    );
  };
  const nextMonth = () => {
    setView((prev) =>
      prev.month === 11
        ? { year: prev.year + 1, month: 0 }
        : { year: prev.year, month: prev.month + 1 },
    );
  };

  // Month-level freeBusy: blocks fully-booked days in the calendar.
  const { busy: monthBusy, loading: loadingMonth } = useMonthFreeBusy(
    serviceId,
    view.year,
    view.month,
  );

  const fullyBlockedDates = useMemo(() => {
    const blocked = new Set<string>();
    if (monthBusy.length === 0) return blocked;
    const days = getCalendarDays(view.year, view.month);
    for (const day of days) {
      if (!day || !isAvailableDay(day)) continue;
      const slots = getTimeSlotsForDashboard(
        day,
        serviceCategory,
        durationMinutes,
        monthBusy,
      );
      if (slots.length > 0 && slots.every((s) => s.booked)) {
        blocked.add(localDateStr(day));
      }
    }
    return blocked;
  }, [monthBusy, view, serviceCategory, durationMinutes]);

  // freeBusy for time-slot availability on the chosen day.
  const { busy: busyIntervals, loading: loadingSlots } = useDayFreeBusy(
    serviceId,
    selectedDate,
  );

  const timeSlots = selectedDate
    ? getTimeSlotsForDashboard(
        selectedDate,
        serviceCategory,
        durationMinutes,
        busyIntervals,
      )
    : [];

  return {
    viewYear: view.year,
    viewMonth: view.month,
    prevMonth,
    nextMonth,
    fullyBlockedDates,
    loadingMonth,
    loadingSlots,
    timeSlots,
  };
}
