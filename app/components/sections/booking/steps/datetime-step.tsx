"use client";

import { useState, useEffect, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import type { BookableService } from "@/data/services-data";
import {
  isAvailableDay,
  isSameDay,
  getCalendarDays,
  getLocalizedMonthName,
  getLocalizedDayNames,
} from "@/utils/calendar-helpers";
import { fetchAvailability, type Availability } from "@/actions/availability";
import { formatCalendarDay, type SupportedLocale } from "@/utils/format";

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
  openDates,
  loadingMonth,
  locale,
}: {
  selected: Date | null;
  onSelect: (d: Date) => void;
  viewYear: number;
  viewMonth: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  /** Dates with at least one free hour. Everything else is closed. */
  openDates: Set<string>;
  loadingMonth: boolean;
  locale: string;
}) {
  const today = new Date();
  const days = getCalendarDays(viewYear, viewMonth);
  const monthName = getLocalizedMonthName(locale, viewYear, viewMonth);
  const dayNames = getLocalizedDayNames(locale);

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
          <p className="text-petroleum-700 text-sm font-semibold tracking-wide capitalize">
            {monthName} {viewYear}
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
        {dayNames.map((d) => (
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
          const available =
            isAvailableDay(day) && openDates.has(localDateStr(day));
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
  tierId,
  staffId,
  durationMinutes,
  selectedDate,
  selectedTime,
  onSelectDate,
  onSelectTime,
}: {
  service: BookableService;
  /** The chosen session type: its assigned staff decide the hours. */
  tierId: string | null;
  /** Narrows availability to one person once the visitor has picked. */
  staffId?: string | null;
  durationMinutes?: number;
  selectedDate: Date | null;
  selectedTime: string | null;
  onSelectDate: (d: Date) => void;
  onSelectTime: (t: string) => void;
}) {
  const t = useTranslations("booking.datetimeStep");
  const locale = useLocale();
  const dateLocale = locale === "es" ? "es-ES" : "en-GB";
  const today = new Date();
  const [viewYear, setViewYear] = useState(() => today.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => today.getMonth());

  const [view, setView] = useState<"date" | "time">(
    selectedDate ? "time" : "date",
  );

  // What the assigned staff's schedules leave free, by date. Google Calendar
  // is not consulted: it receives the bookings we confirm, it does not decide
  // which hours exist.
  const [availability, setAvailability] = useState<Availability>({});
  const [loadingMonth, setLoadingMonth] = useState(true);

  const sessionMinutes =
    durationMinutes ??
    (service.durations.length > 0
      ? parseInt(service.durations[0]!, 10) || 60
      : 60);

  useEffect(() => {
    let cancelled = false;
    const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();
    const month = String(viewMonth + 1).padStart(2, "0");

    void (
      tierId
        ? fetchAvailability({
            tierId,
            staffId: staffId ?? null,
            from: `${viewYear}-${month}-01`,
            to: `${viewYear}-${month}-${String(lastDay).padStart(2, "0")}`,
            durationMinutes: sessionMinutes,
          })
        : Promise.resolve({} as Availability)
    ).then((result) => {
      if (cancelled) return;
      setAvailability(result);
      setLoadingMonth(false);
    });

    return () => {
      cancelled = true;
    };
  }, [tierId, staffId, viewYear, viewMonth, sessionMinutes]);

  // A day nobody works, or one whose hours are all taken, is not offered.
  const openDates = useMemo(
    () => new Set(Object.keys(availability)),
    [availability],
  );

  const handleDateSelect = (d: Date) => {
    onSelectDate(d);
    onSelectTime("");
    setView("time");
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

  const availableSlots = (
    selectedDate ? (availability[localDateStr(selectedDate)] ?? []) : []
  ).map((time) => ({ time, booked: false }));

  return view === "date" ? (
    <div className="mx-auto inline-block w-full rounded-2xl bg-white p-5">
      <CalendarView
        selected={selectedDate}
        onSelect={handleDateSelect}
        viewYear={viewYear}
        viewMonth={viewMonth}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        openDates={openDates}
        loadingMonth={loadingMonth}
        locale={dateLocale}
      />
    </div>
  ) : (
    <div className="flex flex-col gap-5">
      <button
        onClick={handleChangeDate}
        className="border-sand-300 bg-sand-50 hover:border-petroleum-100 flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-all duration-200"
      >
        <div className="flex flex-col gap-1">
          <p className="text-petroleum-400 text-xs">{t("date")}</p>
          <p className="text-petroleum-700 font-medium">
            {formatCalendarDay(selectedDate!, locale as SupportedLocale, {
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
        <p className="text-petroleum-400 text-sm">{t("availableTimes")}</p>
        {loadingMonth ? (
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
              {t("noAvailability")}
            </p>
            <p className="text-petroleum-400 text-xs">{t("tryAnother")}</p>
            <button
              onClick={handleChangeDate}
              className="bg-petroleum-700 hover:bg-petroleum-600 mt-1 rounded-xl px-4 py-2 text-sm font-medium text-white transition-colors"
            >
              {t("chooseAnother")}
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
