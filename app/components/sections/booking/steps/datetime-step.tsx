"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import type { BookableService } from "@/data/services-data";
import {
  MONTH_NAMES,
  DAY_NAMES,
  isAvailableDay,
  isSameDay,
  getCalendarDays,
  getTimeSlots,
  getTimeSlotsForDashboard,
} from "@/utils/calendar-helpers";

type BusyInterval = { start: string; end: string };

function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function CalendarView({
  selected,
  onSelect,
  viewYear,
  viewMonth,
  onPrevMonth,
  onNextMonth,
  fullyBlockedDates,
  loadingMonth,
}: {
  selected: Date | null;
  onSelect: (d: Date) => void;
  viewYear: number;
  viewMonth: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  fullyBlockedDates: Set<string>;
  loadingMonth: boolean;
}) {
  const today = new Date();
  const days = getCalendarDays(viewYear, viewMonth);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          onClick={onPrevMonth}
          className="text-petroleum-400 hover:text-petroleum-700 hover:bg-sand-200 rounded-lg p-2 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-2">
          <p className="text-petroleum-700 text-sm font-semibold tracking-wide">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </p>
          {loadingMonth && (
            <span className="border-petroleum-300 size-3 animate-spin rounded-full border border-t-transparent" />
          )}
        </div>
        <button
          onClick={onNextMonth}
          className="text-petroleum-400 hover:text-petroleum-700 hover:bg-sand-200 rounded-lg p-2 transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7">
        {DAY_NAMES.map((d) => (
          <div
            key={d}
            className="text-petroleum-400 py-2 text-center text-xs font-semibold tracking-wide uppercase"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          const cellKey = day ? localDateStr(day) : `empty-${i}`;
          if (!day) return <div key={cellKey} />;
          const baseAvailable = isAvailableDay(day);
          const isBlocked =
            baseAvailable && fullyBlockedDates.has(localDateStr(day));
          const available = baseAvailable && !isBlocked;
          const isSelected = selected ? isSameDay(day, selected) : false;
          const isToday = isSameDay(day, today);
          return (
            <button
              key={cellKey}
              disabled={!available}
              onClick={() => available && onSelect(day)}
              className={[
                "flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-medium transition-all",
                isSelected
                  ? "bg-petroleum-400 text-sand-50 shadow-sm"
                  : available
                    ? "text-petroleum-700 hover:bg-petroleum-100 border-petroleum-100 bg-petroleum-50 cursor-pointer border"
                    : "text-sand-400 border-sand-200 cursor-not-allowed border opacity-40",
              ].join(" ")}
            >
              {day.getDate()}
              {isToday && !isSelected && (
                <span className="bg-petroleum-400 mt-0.5 size-1 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DateTimeStep({
  service,
  serviceId,
  durationMinutes,
  selectedDate,
  selectedTime,
  onSelectDate,
  onSelectTime,
}: {
  service: BookableService;
  serviceId: string;
  durationMinutes?: number;
  selectedDate: Date | null;
  selectedTime: string | null;
  onSelectDate: (d: Date) => void;
  onSelectTime: (t: string) => void;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(() => today.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => today.getMonth());

  const [view, setView] = useState<"date" | "time">(
    selectedDate ? "time" : "date",
  );

  // Month-level busy intervals (for blocking days in the calendar)
  const [monthBusy, setMonthBusy] = useState<BusyInterval[]>([]);
  const [loadingMonth, setLoadingMonth] = useState(false);

  // Day-level busy intervals (for slot display after date is selected)
  const [busyIntervals, setBusyIntervals] = useState<BusyInterval[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Pre-fetch busy intervals for the whole visible month
  useEffect(() => {
    let cancelled = false;
    async function fetchMonth() {
      setLoadingMonth(true);
      try {
        const startDate = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-01`;
        const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();
        const endDate = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
        const res = await fetch(
          `/api/google/calendar/freebusy?service_id=${serviceId}&start=${startDate}&end=${endDate}`,
        );
        if (res.ok && !cancelled) {
          const json = (await res.json()) as { busy: BusyInterval[] };
          setMonthBusy(json.busy ?? []);
        }
      } catch {
        // fail-open: no blocking
      } finally {
        if (!cancelled) setLoadingMonth(false);
      }
    }
    void fetchMonth();
    return () => {
      cancelled = true;
    };
  }, [serviceId, viewYear, viewMonth]);

  // Compute which available days in this month are fully booked
  const fullyBlockedDates = useMemo(() => {
    const blocked = new Set<string>();
    if (monthBusy.length === 0) return blocked;
    const days = getCalendarDays(viewYear, viewMonth);
    for (const day of days) {
      if (!day || !isAvailableDay(day)) continue;
      const slots = durationMinutes
        ? getTimeSlotsForDashboard(
            day,
            service.category,
            durationMinutes,
            monthBusy,
          )
        : getTimeSlots(day, service, monthBusy);
      if (slots.length > 0 && slots.every((s) => s.booked)) {
        blocked.add(localDateStr(day));
      }
    }
    return blocked;
  }, [monthBusy, viewYear, viewMonth, service, durationMinutes]);

  const fetchBusyIntervals = async (d: Date) => {
    setLoadingSlots(true);
    try {
      const res = await fetch(
        `/api/google/calendar/freebusy?service_id=${serviceId}&date=${localDateStr(d)}`,
      );
      if (res.ok) {
        const json = (await res.json()) as { busy: BusyInterval[] };
        setBusyIntervals(json.busy ?? []);
      } else {
        setBusyIntervals([]);
      }
    } catch {
      setBusyIntervals([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleDateSelect = (d: Date) => {
    onSelectDate(d);
    onSelectTime("");
    setView("time");
    void fetchBusyIntervals(d);
  };

  const handleChangeDate = () => {
    onSelectTime("");
    setView("date");
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  };

  const slots = selectedDate
    ? durationMinutes
      ? getTimeSlotsForDashboard(
          selectedDate,
          service.category,
          durationMinutes,
          busyIntervals,
        )
      : getTimeSlots(selectedDate, service, busyIntervals)
    : [];

  const availableSlots = slots.filter((s) => !s.booked);

  return view === "date" ? (
    <div className="mx-auto inline-block w-full rounded-2xl bg-white p-5">
      <CalendarView
        selected={selectedDate}
        onSelect={handleDateSelect}
        viewYear={viewYear}
        viewMonth={viewMonth}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        fullyBlockedDates={fullyBlockedDates}
        loadingMonth={loadingMonth}
      />
    </div>
  ) : (
    <div className="flex flex-col gap-5">
      <button
        onClick={handleChangeDate}
        className="border-sand-300 bg-sand-50 hover:border-petroleum-100 flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-all duration-200"
      >
        <div className="flex flex-col gap-1">
          <p className="text-petroleum-400 text-xs">Date</p>
          <p className="text-petroleum-700 font-medium">
            {selectedDate!.toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <ChevronDown className="text-petroleum-400 shrink-0" size={16} />
      </button>

      <div className="flex flex-col gap-3">
        <p className="text-petroleum-400 text-sm">Available times</p>
        {loadingSlots ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="bg-sand-100 h-10 animate-pulse rounded-xl"
              />
            ))}
          </div>
        ) : availableSlots.length === 0 ? (
          <div className="border-sand-200 bg-sand-50 flex flex-col items-center gap-3 rounded-2xl border px-4 py-8 text-center">
            <p className="text-petroleum-500 text-sm font-medium">
              No availability for this day
            </p>
            <p className="text-petroleum-400 text-xs">
              Please choose a different date.
            </p>
            <button
              onClick={handleChangeDate}
              className="bg-petroleum-700 hover:bg-petroleum-600 mt-1 rounded-xl px-4 py-2 text-sm font-medium text-white transition-colors"
            >
              Choose another date
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {availableSlots.map(({ time }) => (
              <button
                key={time}
                onClick={() => onSelectTime(time)}
                className={[
                  "rounded-xl border py-2.5 text-sm font-medium transition-all",
                  selectedTime === time
                    ? "bg-petroleum-400 border-petroleum-400 text-sand-50 shadow-sm"
                    : "bg-petroleum-50 border-petroleum-100 text-petroleum-700 hover:bg-petroleum-100 cursor-pointer",
                ].join(" ")}
              >
                {time}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
