"use client";

import { useState, useReducer } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/components/auth-provider";
import { useRole } from "@/context/role-context";
import { CalendarFiltersModal } from "@/components/dashboard/calendar/calendar-filters-modal";
import { EMPTY_FILTERS, type CalendarFilters } from "@/utils/calendar-filters";
import type { CalendarView, CalendarEvent } from "@/types/calendar";
import { MonthGrid } from "@/components/dashboard/calendar/month-grid";
import { WeekGrid } from "@/components/dashboard/calendar/week-grid";
import { DayList } from "@/components/dashboard/calendar/day-list";
import { CalendarHeader } from "./calendar-header";
import { DashboardActions } from "./dashboard-actions";
import { calNavReducer } from "./cal-nav";
import { useCalendarEvents, useFilterOptions } from "./use-calendar-data";
import {
  toYMD,
  groupByDate,
  formatPeriod,
  isPastDay,
  isPastSlot,
} from "@/utils/dashboard-calendar";

export default function DashboardPage() {
  const t = useTranslations("dashboard.calendar");
  const tTooltip = useTranslations("dashboard.calendar.tooltip");
  const locale = useLocale();
  const { push } = useRouter();
  const { user } = useAuth();
  const { role } = useRole();
  const isPartner = role === "partner";

  // Filters narrow the query rather than the drawn events, so a month with two
  // hundred bookings does not have to be fetched to show three.
  const [filters, setFilters] = useState<CalendarFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { staffOptions, tierOptions } = useFilterOptions();

  const [calNav, dispatchCalNav] = useReducer(calNavReducer, {
    view: "month" as CalendarView,
    anchor: new Date(),
  });
  const { view, anchor } = calNav;

  const { loading: calendarLoading, events: calendarEvents } =
    useCalendarEvents({
      view,
      anchor,
      isPartner,
      userId: user?.id,
      filters,
      // Resolved here rather than passed as a translator: `t` is not
      // guaranteed to be referentially stable, and the hook depends on these.
      labels: {
        bookingFallback: t("bookingFallback"),
        staff: tTooltip("staff"),
        noStaff: tTooltip("noStaff"),
      },
    });

  const eventsByDay = groupByDate(calendarEvents);
  const periodLabel = formatPeriod(view, anchor, locale);

  function handleDayClick(d: Date) {
    // The grids already hide the affordance; this keeps a stray click on a past
    // cell from opening the booking form pre-filled with a date nobody can use.
    if (isPastDay(d)) return;
    push(`/dashboard/bookings/new?date=${toYMD(d)}`);
  }

  function handleEventClick(event: CalendarEvent) {
    // A busy block has no detail page — it exists so the slot does not read as
    // free, and the partner has no right to whatever sits behind it.
    if (event.type === "busy" || !event.href) return;
    push(event.href);
  }

  function handleSlotClick(time: string) {
    if (isPastSlot(anchor, time)) return;
    push(`/dashboard/bookings/new?date=${toYMD(anchor)}&time=${time}`);
  }

  return (
    <div className="py-8">
      <div className="grid grid-cols-1 gap-6 lg:px-10">
        {!isPartner && (
          <DashboardActions
            filters={filters}
            onOpenFilters={() => setFiltersOpen(true)}
          />
        )}

        <div className="border-sand-200 border-y bg-white lg:overflow-hidden lg:rounded-2xl lg:border">
          <CalendarHeader
            view={view}
            periodLabel={periodLabel}
            dispatchCalNav={dispatchCalNav}
          />

          {view === "month" && (
            <MonthGrid
              anchor={anchor}
              eventsByDay={eventsByDay}
              loading={calendarLoading}
              onDayClick={handleDayClick}
              onEventClick={handleEventClick}
            />
          )}
          {view === "week" && (
            <WeekGrid
              anchor={anchor}
              eventsByDay={eventsByDay}
              loading={calendarLoading}
              onEventClick={handleEventClick}
              onDayClick={handleDayClick}
            />
          )}
          {view === "day" && (
            <DayList
              anchor={anchor}
              eventsByDay={eventsByDay}
              loading={calendarLoading}
              onEventClick={handleEventClick}
              onSlotClick={handleSlotClick}
            />
          )}
        </div>
      </div>

      {filtersOpen && (
        <CalendarFiltersModal
          filters={filters}
          staffOptions={staffOptions}
          tierOptions={tierOptions}
          onApply={(next) => {
            setFilters(next);
            setFiltersOpen(false);
          }}
          onClose={() => setFiltersOpen(false)}
        />
      )}
    </div>
  );
}
