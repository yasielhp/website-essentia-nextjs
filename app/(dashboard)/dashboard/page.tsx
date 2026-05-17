"use client";

import { useState, useEffect, useReducer } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { loadColorSettings, DEFAULT_COLORS } from "@/utils/color-settings";
import type {
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
  navigateAnchor,
} from "@/utils/dashboard-calendar";
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

import { StatCard } from "@/components/dashboard/calendar/stat-card";
import { MonthGrid } from "@/components/dashboard/calendar/month-grid";
import { WeekGrid } from "@/components/dashboard/calendar/week-grid";
import { DayList } from "@/components/dashboard/calendar/day-list";
import { UpcomingRaceCard } from "@/components/dashboard/calendar/upcoming-race-card";
import { UpcomingSessionCard } from "@/components/dashboard/calendar/upcoming-session-card";

export default function DashboardPage() {
  const { push } = useRouter();

  // Stats
  const [stats, setStats] = useState<{
    loading: boolean;
    totalBookings: number;
    confirmedBookings: number;
    totalContacts: number;
    upcomingEvents: number;
  }>({
    loading: true,
    totalBookings: 0,
    confirmedBookings: 0,
    totalContacts: 0,
    upcomingEvents: 0,
  });
  const {
    loading: statsLoading,
    totalBookings,
    confirmedBookings,
    totalContacts,
    upcomingEvents,
  } = stats;

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

  // Today — computed client-side only to avoid hydration mismatch
  const [todayYMD, setTodayYMD] = useState("");

  // Load stats once
  useEffect(() => {
    async function loadStats() {
      const [allRes, confirmedRes, contactsRes, membersRes] = await Promise.all(
        [
          insforge.database
            .from("bookings")
            .select("id", { count: "exact", head: true }),
          insforge.database
            .from("bookings")
            .select("id", { count: "exact", head: true })
            .eq("status", "confirmed"),
          insforge.database
            .from("contacts")
            .select("id", { count: "exact", head: true }),
          insforge.database
            .from("memberships")
            .select("id", { count: "exact", head: true }),
        ],
      );
      setStats({
        loading: false,
        totalBookings: (allRes as { count: number | null }).count ?? 0,
        confirmedBookings:
          (confirmedRes as { count: number | null }).count ?? 0,
        totalContacts: (contactsRes as { count: number | null }).count ?? 0,
        upcomingEvents: (membersRes as { count: number | null }).count ?? 0,
      });
    }
    void loadStats();
  }, []);

  // Load upcoming race + session once
  useEffect(() => {
    async function loadUpcoming() {
      const todayStr = toYMD(new Date());
      const nowIso = new Date().toISOString();
      const [raceRes, sessionRes] = await Promise.all([
        insforge.database
          .from("races")
          .select("id, title, date, location, distance_km")
          .gte("date", todayStr)
          .order("date", { ascending: true })
          .limit(1),
        insforge.database
          .from("education_sessions")
          .select("id, title, date, location, speaker, duration_minutes")
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

  // Set today client-side only
  useEffect(() => {
    async function setToday() {
      setTodayYMD(toYMD(new Date()));
    }
    void setToday();
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

      const [bookingsRes, racesRes, sessionsRes] = await Promise.all([
        insforge.database
          .from("bookings")
          .select(
            "id, date, time, service_id, service_title, first_name, last_name",
          )
          .gte("date", fromDate)
          .lte("date", toDate)
          .order("time", { ascending: true }),
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
          "Booking";
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

      for (const r of (racesRes.data ?? []) as Record<string, unknown>[]) {
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

      for (const s of (sessionsRes.data ?? []) as Record<string, unknown>[]) {
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
  }, [view, anchor]);

  const eventsByDay = groupByDate(calendarEvents);
  const periodLabel = formatPeriod(view, anchor);
  const isAnchorToday = toYMD(anchor) === todayYMD;

  function handleDayClick(d: Date) {
    dispatchCalNav({ type: "set-anchor", anchor: d });
    dispatchCalNav({ type: "set-view", view: "day" });
  }

  function handleTodayClick() {
    dispatchCalNav({ type: "set-anchor", anchor: new Date() });
  }

  function handleEventClick(event: CalendarEvent) {
    push(event.href);
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Confirmed Bookings"
          value={confirmedBookings}
          loading={statsLoading}
          href="/dashboard/bookings"
        />
        <StatCard
          label="Total Bookings"
          value={totalBookings}
          loading={statsLoading}
          href="/dashboard/bookings"
        />
        <StatCard
          label="Total Contacts"
          value={totalContacts}
          loading={statsLoading}
          href="/dashboard/contacts"
        />
        <StatCard
          label="Total Members"
          value={upcomingEvents}
          loading={statsLoading}
          href="/dashboard/members"
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_300px]">
        {/* Calendar */}
        <div className="border-sand-200 rounded-2xl border bg-white">
          {/* Calendar header */}
          <div className="border-sand-200 flex flex-wrap items-center gap-3 border-b px-5 py-3">
            {/* View switcher */}
            <div className="border-sand-200 bg-sand-50 flex rounded-xl border p-0.5">
              {(["month", "week", "day"] as CalendarView[]).map((v) => (
                <button
                  key={v}
                  onClick={() => dispatchCalNav({ type: "set-view", view: v })}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all ${
                    view === v
                      ? "text-petroleum-700 bg-white shadow-sm"
                      : "text-petroleum-400 hover:text-petroleum-700"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            {/* Period nav */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => dispatchCalNav({ type: "nav", delta: -1 })}
                className="text-petroleum-500 hover:bg-sand-100 flex size-7 items-center justify-center rounded-lg text-lg leading-none transition-colors"
              >
                ‹
              </button>
              <span className="text-petroleum-700 min-w-[148px] text-center text-sm font-medium">
                {periodLabel}
              </span>
              <button
                onClick={() => dispatchCalNav({ type: "nav", delta: 1 })}
                className="text-petroleum-500 hover:bg-sand-100 flex size-7 items-center justify-center rounded-lg text-lg leading-none transition-colors"
              >
                ›
              </button>
            </div>

            {/* Today */}
            <button
              onClick={handleTodayClick}
              disabled={isAnchorToday && view !== "month"}
              className={`text-xs font-medium transition-colors disabled:opacity-30 ${
                isAnchorToday && view !== "month"
                  ? "text-petroleum-300 cursor-default"
                  : "text-petroleum-500 hover:text-petroleum-700"
              }`}
            >
              Today
            </button>

            {/* New booking shortcut */}
            <Link
              href="/dashboard/bookings/new"
              className="bg-petroleum-700 hover:bg-petroleum-600 ml-auto flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-white transition-colors"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M12 5v14M5 12h14"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
              New Booking
            </Link>
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
            />
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          <UpcomingRaceCard race={upcomingRace} loading={upcomingLoading} />
          <UpcomingSessionCard
            session={upcomingSession}
            loading={upcomingLoading}
          />
        </div>
      </div>
    </div>
  );
}
