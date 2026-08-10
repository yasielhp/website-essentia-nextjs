"use client";

import { type Dispatch } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatCalendarDay } from "@/utils/format";
import { CalendarView } from "./calendar-view";
import { CompletedRow } from "./completed-row";
import type { FormAction } from "./form-state";

/**
 * When the session happens.
 *
 * Shown only once a professional is chosen: the calendar answers "when is this
 * person free", and without a person there is no question to answer.
 */
export function DateTimeStep({
  selectedDate,
  selectedTime,
  calendarView,
  openDates,
  timeSlots,
  loadingSlots,
  availabilityMonth,
  datetimeLabel,
  editing,
  onEdit,
  onDone,
  onMonthChange,
  dispatchForm,
}: {
  selectedDate: Date | null;
  selectedTime: string;
  calendarView: "date" | "time";
  /** Days the chosen professional can take, `YYYY-MM-DD`. */
  openDates: Set<string>;
  timeSlots: { time: string; booked: boolean }[];
  loadingSlots: boolean;
  availabilityMonth: { year: number; month: number };
  /** The chosen day and hour in words, for the one-line summary. */
  datetimeLabel: string;
  /** True while this step is the one being answered. */
  editing: boolean;
  onEdit: () => void;
  /** Called once an hour is picked and the step can close. */
  onDone: () => void;
  onMonthChange: (year: number, month: number) => void;
  dispatchForm: Dispatch<FormAction>;
}) {
  const t = useTranslations("dashboard.bookings.form");

  return (
    <>
      {selectedDate && selectedTime && !editing ? (
        <CompletedRow
          label={t("steps.datetime")}
          value={datetimeLabel}
          onEdit={onEdit}
        />
      ) : (
        <div className="border-sand-200 animate-fade-in-up rounded-2xl border bg-white p-6">
          <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
            Date & Time
          </h2>
          {calendarView === "date" ? (
            <CalendarView
              selected={selectedDate}
              openDates={openDates}
              viewYear={availabilityMonth.year}
              viewMonth={availabilityMonth.month}
              onMonthChange={onMonthChange}
              onSelect={(d) => dispatchForm({ type: "SET_DATE", value: d })}
            />
          ) : (
            <div className="flex flex-col gap-5">
              <button
                type="button"
                onClick={() =>
                  dispatchForm({
                    type: "SET_CALENDAR_VIEW",
                    value: "date",
                  })
                }
                className="border-sand-300 bg-sand-50 hover:border-petroleum-100 flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-colors duration-200"
              >
                <div className="flex flex-col gap-1">
                  <p className="text-petroleum-400 text-xs">Date</p>
                  <p className="text-petroleum-700 font-medium">
                    {selectedDate &&
                      formatCalendarDay(selectedDate, "en", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                  </p>
                </div>
                <ChevronDown
                  className="text-petroleum-400 shrink-0"
                  size={16}
                />
              </button>
              <div className="flex flex-col gap-3">
                <p className="text-petroleum-400 text-sm">
                  {t("availableTimes")}
                </p>
                {loadingSlots ? (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div
                        key={i}
                        className="bg-sand-100 h-10 animate-pulse rounded-xl"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {timeSlots.map(({ time, booked }) => (
                      <button
                        key={time}
                        type="button"
                        disabled={booked}
                        onClick={() => {
                          if (booked) return;
                          dispatchForm({
                            type: "SET_TIME",
                            value: time,
                          });
                          onDone();
                        }}
                        className={[
                          "rounded-xl border py-2.5 text-sm font-medium transition-colors",
                          selectedTime === time
                            ? "bg-petroleum-400 border-petroleum-400 text-sand-50 shadow-sm"
                            : booked
                              ? "border-sand-200 text-sand-400 cursor-not-allowed opacity-40"
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
          )}
        </div>
      )}
    </>
  );
}
