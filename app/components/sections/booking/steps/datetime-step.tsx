"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import type { BookableService } from "@/data/services-data";
import {
  MONTH_NAMES,
  DAY_NAMES,
  isAvailableDay,
  isSameDay,
  getCalendarDays,
  getTimeSlots,
} from "@/utils/calendar-helpers";

function CalendarView({
  selected,
  onSelect,
}: {
  selected: Date | null;
  onSelect: (d: Date) => void;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const days = getCalendarDays(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="text-petroleum-400 hover:text-petroleum-700 hover:bg-sand-200 rounded-lg p-2 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-petroleum-700 text-sm font-semibold tracking-wide">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </p>
        <button
          onClick={nextMonth}
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
          if (!day) return <div key={i} />;
          const available = isAvailableDay(day);
          const isSelected = selected ? isSameDay(day, selected) : false;
          const isToday = isSameDay(day, today);
          return (
            <button
              key={i}
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
  selectedDate,
  selectedTime,
  onSelectDate,
  onSelectTime,
}: {
  service: BookableService;
  selectedDate: Date | null;
  selectedTime: string | null;
  onSelectDate: (d: Date) => void;
  onSelectTime: (t: string) => void;
}) {
  const [view, setView] = useState<"date" | "time">(
    selectedDate ? "time" : "date",
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

  if (view === "date") {
    return (
      <div className="mx-auto inline-block w-full rounded-2xl bg-white p-5">
        <CalendarView selected={selectedDate} onSelect={handleDateSelect} />
      </div>
    );
  }

  const slots = selectedDate ? getTimeSlots(selectedDate, service) : [];

  return (
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
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {slots
            .filter(({ booked }) => !booked)
            .map(({ time }) => (
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
      </div>
    </div>
  );
}
