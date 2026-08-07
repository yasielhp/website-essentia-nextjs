"use client";

import { useState, useEffect, useReducer } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { insforge } from "@/lib/insforge";
import { getAccessToken } from "@/lib/client-session";
import { fetchBusySlots, fetchCalendarBusy } from "@/actions/busy-slots";
import { useAuth } from "@/components/auth-provider";
import { useRole } from "@/context/role-context";
import { loadColorSettings, DEFAULT_COLORS } from "@/utils/color-settings";
import type {
  BusySlot,
  CalendarView,
  CalendarEvent,
  UpcomingRace,
  UpcomingSession,
} from "@/types/calendar";
import {
  toYMD,
  getWeekDays,
  groupByDate,
  formatPeriod,
  intervalToLocalSlot,
  isPastDay,
  isPastSlot,
  navigateAnchor,
} from "@/utils/dashboard-calendar";
/** Neutral grey for slots a partner may see as taken but never open. */
const BUSY_COLOR = "#94a3b8";

// ─── Calendar navigation reducer ─────────────────────────────

type CalNav = { view: CalendarView; anchor: Date };
type CalNavAction =
  | { type: "set-view"; view: CalendarView }
  | { type: "set-anchor"; anchor: Date }
  | { type: "nav"; delta: -1 | 1 };

function calNavReducer(state: CalNav, action: CalNavAction): CalNav {
  switch (action.type) {
    case "set-view":
      return { ...state, view: action.view };
    case "set-anchor":
      return { ...state, anchor: action.anchor };
    case "nav":
      return {
        ...state,
        anchor: navigateAnchor(state.view, state.anchor, action.delta),
      };
  }
}

import { MonthGrid } from "@/components/dashboard/calendar/month-grid";
import { WeekGrid } from "@/components/dashboard/calendar/week-grid";
import { DayList } from "@/components/dashboard/calendar/day-list";
import { UpcomingRaceCard } from "@/components/dashboard/calendar/upcoming-race-card";
import { UpcomingSessionCard } from "@/components/dashboard/calendar/upcoming-session-card";

export default function DashboardPage() {
  const t = useTranslations("dashboard.calendar");
  const locale = useLocale();
  const { push } = useRouter();
  const { user } = useAuth();
  const { role } = useRole();
  const isPartner = role === "partner";
  // Resolved outside the effect so the dependency is a plain string rather
  // than the translator, which is not guaranteed to be referentially stable.
  const bookingFallback = t("bookingFallback");
  const busyLabel = t("busy");
  // A prefix rather than an interpolated message: the name is only known
  // inside the effect, and `t` is not a safe dependency there.
  const bookedByLabel = t("bookedBy");

  // Upcoming
  const [upcoming, setUpcoming] = useState<{
    loading: boolean;
    race: UpcomingRace | null;
    session: UpcomingSession | null;
  }>({ loading: true, race: null, session: null });
  const {
    loading: upcomingLoading,
    race: upcomingRace,
    session: upcomingSession,
  } = upcoming;

  // Calendar navigation — useReducer eliminates separate view/anchor useState
  const [calNav, dispatchCalNav] = useReducer(calNavReducer, {
    view: "month" as CalendarView,
    anchor: new Date(),
  });
  const { view, anchor } = calNav;

  const [calendar, setCalendar] = useState<{
    loading: boolean;
    events: CalendarEvent[];
  }>({ loading: true, events: [] });
  const { loading: calendarLoading, events: calendarEvents } = calendar;

  // Load upcoming race + session once
  useEffect(() => {
    async function loadUpcoming() {
      const todayStr = toYMD(new Date());
      const nowIso = new Date().toISOString();
      const [raceRes, sessionRes] = await Promise.all([
        insforge.database
          .from("races")
          .select("id, title, date, location, distance_km, image_url")
          .gte("date", todayStr)
          .order("date", { ascending: true })
          .limit(1),
        insforge.database
          .from("education_sessions")
          .select(
            "id, title, date, location, speaker, duration_minutes, image_url",
          )
          .gte("date", nowIso)
          .order("date", { ascending: true })
          .limit(1),
      ]);
      setUpcoming({
        loading: false,
        race: (raceRes.data as UpcomingRace[] | null)?.[0] ?? null,
        session: (sessionRes.data as UpcomingSession[] | null)?.[0] ?? null,
      });
    }
    void loadUpcoming();
  }, []);

  // Load all calendar events when view/anchor changes
  useEffect(() => {
    async function loadCalendar() {
      const settings = loadColorSettings();

      let fromDate: string;
      let toDate: string;

      if (view === "month") {
        const y = anchor.getFullYear();
        const m = anchor.getMonth();
        fromDate = `${y}-${String(m + 1).padStart(2, "0")}-01`;
        toDate = toYMD(new Date(y, m + 1, 0));
      } else if (view === "week") {
        const days = getWeekDays(anchor);
        fromDate = toYMD(days[0]!);
        toDate = toYMD(days[6]!);
      } else {
        fromDate = toDate = toYMD(anchor);
      }

      const toDateEnd = toDate + "T23:59:59.999";

      let bookingsQuery = insforge.database
        .from("bookings")
        .select(
          "id, date, time, service_id, service_title, first_name, last_name",
        )
        .gte("date", fromDate)
        .lte("date", toDate)
        .order("time", { ascending: true });

      if (isPartner && user?.id) {
        bookingsQuery = bookingsQuery.eq("partner_id", user.id);
      }

      // Partners cannot read anyone else's bookings, so those slots would show
      // up empty and bookable. Pull them as anonymous blocks instead, plus
      // whatever the connected Google calendars report as busy.
      const [bookingsRes, busySlots, calendarBusy] = await Promise.all([
        bookingsQuery,
        isPartner
          ? fetchBusySlots(getAccessToken(), fromDate, toDate)
          : Promise.resolve([] as BusySlot[]),
        isPartner
          ? fetchCalendarBusy(getAccessToken(), fromDate, toDate)
          : Promise.resolve([] as { start: string; end: string }[]),
      ]);

      const [racesRes, sessionsRes] = isPartner
        ? [{ data: null }, { data: null }]
        : await Promise.all([
            insforge.database
              .from("races")
              .select("id, title, date, location")
              .gte("date", fromDate)
              .lte("date", toDateEnd),
            insforge.database
              .from("education_sessions")
              .select("id, title, date, location, speaker")
              .gte("date", fromDate)
              .lte("date", toDateEnd),
          ]);

      const events: CalendarEvent[] = [];

      for (const b of (bookingsRes.data ?? []) as Record<string, unknown>[]) {
        const serviceId = b.service_id as string | null;
        const color =
          (serviceId && settings.services[serviceId]) ||
          (serviceId && DEFAULT_COLORS.services[serviceId]) ||
          "#64748b";
        const name =
          [b.first_name, b.last_name].filter(Boolean).join(" ") ||
          (b.service_title as string) ||
          bookingFallback;
        events.push({
          id: b.id as string,
          date: (b.date as string).slice(0, 10),
          time: b.time as string | null,
          title: name,
          subtitle: b.service_title as string | undefined,
          color,
          href: `/dashboard/bookings/${b.id}`,
          type: "booking",
        });
      }

      // Every slot already accounted for, so a booking that also lives on the
      // Google calendar is not drawn twice.
      const claimed = new Set(
        events.map((e) => `${e.date} ${e.time?.slice(0, 5) ?? ""}`),
      );

      busySlots.forEach((slot, i) => {
        claimed.add(`${slot.date} ${slot.time?.slice(0, 5) ?? ""}`);
        events.push({
          id: `busy-${slot.date}-${slot.time ?? "allday"}-${i}`,
          date: slot.date,
          time: slot.time,
          title: slot.bookedBy
            ? `${bookedByLabel} ${slot.bookedBy}`
            : busyLabel,
          subtitle: slot.duration ?? undefined,
          color: BUSY_COLOR,
          href: "",
          type: "busy",
        });
      });

      calendarBusy.forEach((interval, i) => {
        const { date, time, minutes } = intervalToLocalSlot(interval);
        if (claimed.has(`${date} ${time}`)) return;
        claimed.add(`${date} ${time}`);
        events.push({
          id: `gcal-${date}-${time}-${i}`,
          date,
          time,
          title: busyLabel,
          subtitle: minutes > 0 ? `${minutes} min` : undefined,
          color: BUSY_COLOR,
          href: "",
          type: "busy",
        });
      });

      for (const r of (racesRes?.data ?? []) as Record<string, unknown>[]) {
        events.push({
          id: r.id as string,
          date: (r.date as string).slice(0, 10),
          time: null,
          title: r.title as string,
          subtitle: r.location as string | undefined,
          color: settings.races,
          href: `/dashboard/races/${r.id}/edit`,
          type: "race",
        });
      }

      for (const s of (sessionsRes?.data ?? []) as Record<string, unknown>[]) {
        const d = new Date(s.date as string);
        const h = d.getUTCHours();
        const m = d.getUTCMinutes();
        const time =
          h === 0 && m === 0
            ? null
            : `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        events.push({
          id: s.id as string,
          date: (s.date as string).slice(0, 10),
          time,
          title: s.title as string,
          subtitle:
            (s.speaker as string | null) ??
            (s.location as string | null) ??
            undefined,
          color: settings.sessions,
          href: `/dashboard/education/${s.id}/edit`,
          type: "session",
        });
      }

      setCalendar({ loading: false, events });
    }
    void loadCalendar();
  }, [
    view,
    anchor,
    isPartner,
    user,
    bookingFallback,
    busyLabel,
    bookedByLabel,
  ]);

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
      {/* Main grid */}
      <div
        className={`grid grid-cols-1 gap-6 lg:px-10 ${!isPartner ? "xl:grid-cols-[1fr_300px]" : ""}`}
      >
        {/* Calendar */}
        <div className="border-sand-200 border-y bg-white lg:overflow-hidden lg:rounded-2xl lg:border">
          {/* Calendar header */}
          <div className="border-sand-200 flex flex-col gap-3 border-b px-5 py-3 sm:flex-row sm:items-center">
            {/* View switcher — full width on mobile, auto on desktop */}
            <div className="border-sand-200 bg-sand-50 flex w-full rounded-xl border p-0.5 sm:w-auto">
              {(["month", "week", "day"] as CalendarView[]).map((v) => (
                <button
                  key={v}
                  onClick={() => dispatchCalNav({ type: "set-view", view: v })}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all sm:flex-none ${
                    view === v
                      ? "text-petroleum-700 bg-white shadow-sm"
                      : "text-petroleum-400 hover:text-petroleum-700"
                  }`}
                >
                  {t(`views.${v}`)}
                </button>
              ))}
            </div>

            {/* Period nav — mobile row */}
            <div className="flex w-full items-center justify-center gap-1 sm:hidden">
              <button
                onClick={() => dispatchCalNav({ type: "nav", delta: -1 })}
                aria-label={t("previousPeriod")}
                className="text-petroleum-500 hover:bg-sand-100 flex size-7 items-center justify-center rounded-lg text-lg leading-none transition-colors"
              >
                ‹
              </button>
              <span className="text-petroleum-700 text-sm font-medium">
                {periodLabel}
              </span>
              <button
                onClick={() => dispatchCalNav({ type: "nav", delta: 1 })}
                aria-label={t("nextPeriod")}
                className="text-petroleum-500 hover:bg-sand-100 flex size-7 items-center justify-center rounded-lg text-lg leading-none transition-colors"
              >
                ›
              </button>
            </div>

            {/* Period nav — desktop, pushed to the right */}
            <div className="ml-auto hidden items-center gap-1 sm:flex">
              <button
                onClick={() => dispatchCalNav({ type: "nav", delta: -1 })}
                aria-label={t("previousPeriod")}
                className="text-petroleum-500 hover:bg-sand-100 flex size-7 items-center justify-center rounded-lg text-lg leading-none transition-colors"
              >
                ‹
              </button>
              <span className="text-petroleum-700 min-w-[148px] text-center text-sm font-medium">
                {periodLabel}
              </span>
              <button
                onClick={() => dispatchCalNav({ type: "nav", delta: 1 })}
                aria-label={t("nextPeriod")}
                className="text-petroleum-500 hover:bg-sand-100 flex size-7 items-center justify-center rounded-lg text-lg leading-none transition-colors"
              >
                ›
              </button>
            </div>
          </div>

          {/* Calendar body */}
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

        {/* Right sidebar */}
        {!isPartner && (
          <div className="space-y-4">
            <UpcomingRaceCard race={upcomingRace} loading={upcomingLoading} />
            <UpcomingSessionCard
              session={upcomingSession}
              loading={upcomingLoading}
            />
          </div>
        )}
      </div>
    </div>
  );
}
