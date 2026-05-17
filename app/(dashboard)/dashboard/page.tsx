"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { loadColorSettings, DEFAULT_COLORS } from "@/utils/color-settings";

// ─── Types ────────────────────────────────────────────────────

type CalendarView = "month" | "week" | "day";

type CalendarEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  time: string | null;
  title: string;
  subtitle?: string;
  color: string;
  href: string;
  type: "booking" | "race" | "session";
};

type UpcomingRace = {
  id: string;
  title: string;
  date: string | null;
  location: string | null;
  distance_km: number | null;
};

type UpcomingSession = {
  id: string;
  title: string;
  date: string;
  location: string | null;
  speaker: string | null;
  duration_minutes: number | null;
};

// ─── Constants ────────────────────────────────────────────────

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ─── Date helpers ─────────────────────────────────────────────

function toYMD(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function getCalendarGrid(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7; // 0 = Mon
  const days: Date[] = [];
  for (let i = startDow; i > 0; i--) {
    days.push(new Date(year, month, 1 - i));
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  let next = 1;
  while (days.length < 42) {
    days.push(new Date(year, month + 1, next++));
  }
  return days;
}

function getWeekDays(anchor: Date): Date[] {
  const dow = (anchor.getDay() + 6) % 7;
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function groupByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const arr = map.get(e.date) ?? [];
    arr.push(e);
    map.set(e.date, arr);
  }
  return map;
}

function sortByTime(events: CalendarEvent[]): CalendarEvent[] {
  return events.toSorted((a, b) => {
    if (!a.time && !b.time) return 0;
    if (!a.time) return 1;
    if (!b.time) return -1;
    return a.time.localeCompare(b.time);
  });
}

function formatPeriod(view: CalendarView, anchor: Date): string {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  if (view === "month") return `${MONTHS[m]} ${y}`;
  if (view === "week") {
    const days = getWeekDays(anchor);
    const s = days[0];
    const e = days[6];
    if (s.getMonth() === e.getMonth())
      return `${MONTHS[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${y}`;
    return `${MONTHS[s.getMonth()]} ${s.getDate()} – ${MONTHS[e.getMonth()]} ${e.getDate()}, ${y}`;
  }
  return anchor.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function navigateAnchor(view: CalendarView, anchor: Date, dir: 1 | -1): Date {
  const d = new Date(anchor);
  if (view === "month") {
    d.setDate(1);
    d.setMonth(d.getMonth() + dir);
  } else if (view === "week") {
    d.setDate(d.getDate() + 7 * dir);
  } else {
    d.setDate(d.getDate() + dir);
  }
  return d;
}

function formatUpcomingDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── Small components ─────────────────────────────────────────

function StatCard({
  label,
  value,
  loading,
  href,
}: {
  label: string;
  value: number;
  loading: boolean;
  href?: string;
}) {
  const inner = (
    <>
      <p className="text-petroleum-400 text-sm">{label}</p>
      {loading ? (
        <div className="bg-sand-100 mt-2 h-8 w-16 animate-pulse rounded-lg" />
      ) : (
        <p className="font-display text-petroleum-700 mt-1 text-3xl">{value}</p>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="border-sand-200 hover:border-petroleum-200 block rounded-2xl border bg-white p-6 transition-colors"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      {inner}
    </div>
  );
}

function EventPill({
  event,
  compact,
  onClick,
}: {
  event: CalendarEvent;
  compact?: boolean;
  onClick: () => void;
}) {
  const bg = event.color + "22";
  const fg = event.color;

  if (compact) {
    return (
      <button
        onClick={onClick}
        style={{ backgroundColor: bg, color: fg }}
        className="mb-0.5 w-full truncate rounded-md px-1.5 py-0.5 text-left text-[11px] leading-4 font-medium transition-opacity hover:opacity-75"
      >
        {event.time && (
          <span className="mr-1 opacity-60">{event.time.slice(0, 5)}</span>
        )}
        {event.title}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      style={{ backgroundColor: bg, color: fg }}
      className="mb-1.5 w-full rounded-xl px-3 py-2 text-left text-xs transition-opacity hover:opacity-75"
    >
      {event.time && (
        <div className="mb-0.5 font-semibold">{event.time.slice(0, 5)}</div>
      )}
      <div className="truncate font-medium">{event.title}</div>
      {event.subtitle && (
        <div className="truncate opacity-70">{event.subtitle}</div>
      )}
    </button>
  );
}

// ─── Calendar views ───────────────────────────────────────────

function MonthGrid({
  anchor,
  eventsByDay,
  loading,
  onDayClick,
  onEventClick,
}: {
  anchor: Date;
  eventsByDay: Map<string, CalendarEvent[]>;
  loading: boolean;
  onDayClick: (d: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
}) {
  const todayYMD = toYMD(new Date());
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const grid = getCalendarGrid(year, month);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-140">
        {/* Day headers */}
        <div className="border-sand-200 grid grid-cols-7 border-b">
          {DAYS_SHORT.map((d) => (
            <div
              key={d}
              className="text-petroleum-400 py-2 text-center text-xs font-medium"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Cells */}
        <div className="grid grid-cols-7 overflow-hidden">
          {grid.map((day) => {
            const ymd = toYMD(day);
            const isCurrentMonth = day.getMonth() === month;
            const isToday = todayYMD !== "" && ymd === todayYMD;
            const dayEvents = sortByTime(eventsByDay.get(ymd) ?? []);
            const extra = dayEvents.length - 2;

            return (
              <div
                key={ymd}
                className={`border-sand-100 min-h-22 border-r border-b p-1.5 ${
                  !isCurrentMonth ? "bg-sand-50/60" : ""
                }`}
              >
                <button
                  onClick={() => onDayClick(day)}
                  className={`mb-1 flex size-6 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                    isToday
                      ? "bg-petroleum-700 text-white"
                      : isCurrentMonth
                        ? "text-petroleum-700 hover:bg-sand-100"
                        : "text-petroleum-300 hover:bg-sand-100"
                  }`}
                >
                  {day.getDate()}
                </button>

                {loading ? (
                  day.getDate() % 3 === 0 && isCurrentMonth ? (
                    <div className="bg-sand-200 mb-0.5 h-3.5 animate-pulse rounded" />
                  ) : null
                ) : (
                  <>
                    {dayEvents.slice(0, 2).map((e) => (
                      <EventPill
                        key={e.id + e.type}
                        event={e}
                        compact
                        onClick={() => onEventClick(e)}
                      />
                    ))}
                    {extra > 0 && (
                      <button
                        onClick={() => onDayClick(day)}
                        className="text-petroleum-400 hover:text-petroleum-700 text-[10px]"
                      >
                        +{extra} more
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WeekGrid({
  anchor,
  eventsByDay,
  loading,
  onEventClick,
  onDayClick,
}: {
  anchor: Date;
  eventsByDay: Map<string, CalendarEvent[]>;
  loading: boolean;
  onEventClick: (event: CalendarEvent) => void;
  onDayClick: (d: Date) => void;
}) {
  const todayYMD = toYMD(new Date());
  const weekDays = getWeekDays(anchor);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-140">
        {/* Day headers */}
        <div className="border-sand-200 grid grid-cols-7 border-b">
          {weekDays.map((day) => {
            const ymd = toYMD(day);
            const isToday = ymd === todayYMD;
            return (
              <div key={ymd} className="py-2 text-center">
                <div className="text-petroleum-400 text-xs">
                  {DAYS_SHORT[(day.getDay() + 6) % 7]}
                </div>
                <button
                  onClick={() => onDayClick(day)}
                  className={`mx-auto mt-1 flex size-7 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                    isToday
                      ? "bg-petroleum-700 text-white"
                      : "text-petroleum-700 hover:bg-sand-100"
                  }`}
                >
                  {day.getDate()}
                </button>
              </div>
            );
          })}
        </div>

        {/* Columns */}
        <div className="grid min-h-80 grid-cols-7">
          {weekDays.map((day) => {
            const ymd = toYMD(day);
            const dayEvents = sortByTime(eventsByDay.get(ymd) ?? []);
            return (
              <div
                key={ymd}
                className="border-sand-100 border-r p-1.5 last:border-r-0"
              >
                {loading ? (
                  day.getDay() % 2 === 0 ? (
                    <div className="bg-sand-100 h-14 animate-pulse rounded-xl" />
                  ) : null
                ) : (
                  dayEvents.map((e) => (
                    <EventPill
                      key={e.id + e.type}
                      event={e}
                      onClick={() => onEventClick(e)}
                    />
                  ))
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DayList({
  anchor,
  eventsByDay,
  loading,
  onEventClick,
}: {
  anchor: Date;
  eventsByDay: Map<string, CalendarEvent[]>;
  loading: boolean;
  onEventClick: (event: CalendarEvent) => void;
}) {
  const ymd = toYMD(anchor);
  const dayEvents = sortByTime(eventsByDay.get(ymd) ?? []);

  const TYPE_LABEL: Record<CalendarEvent["type"], string> = {
    booking: "Booking",
    race: "Race",
    session: "Session",
  };

  return (
    <div className="py-3">
      {loading ? (
        <div className="space-y-2 px-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-sand-100 h-16 animate-pulse rounded-xl"
            />
          ))}
        </div>
      ) : dayEvents.length === 0 ? (
        <div className="text-petroleum-300 py-16 text-center text-sm">
          Nothing scheduled.
        </div>
      ) : (
        <div className="space-y-2 px-4">
          {dayEvents.map((e) => (
            <button
              key={e.id + e.type}
              onClick={() => onEventClick(e)}
              className="border-sand-200 hover:bg-sand-50 flex w-full items-center gap-4 rounded-xl border bg-white px-4 py-3 text-left transition-colors"
            >
              <div
                className="h-8 w-1 shrink-0 rounded-full"
                style={{ backgroundColor: e.color }}
              />
              <div className="text-petroleum-500 w-12 shrink-0 font-mono text-sm">
                {e.time ?? "—"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-petroleum-700 truncate font-medium">
                  {e.title}
                </div>
                {e.subtitle && (
                  <div className="text-petroleum-400 truncate text-xs">
                    {e.subtitle}
                  </div>
                )}
              </div>
              <span
                className="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ backgroundColor: e.color + "22", color: e.color }}
              >
                {TYPE_LABEL[e.type]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Upcoming cards ───────────────────────────────────────────

function UpcomingRaceCard({
  race,
  loading,
}: {
  race: UpcomingRace | null;
  loading: boolean;
}) {
  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className="bg-petroleum-50 flex size-7 items-center justify-center rounded-lg">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            className="text-petroleum-600"
          >
            <path
              d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M4 22v-7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <h3 className="text-petroleum-700 text-sm font-semibold">Next Race</h3>
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="bg-sand-100 h-4 animate-pulse rounded" />
          <div className="bg-sand-100 h-3 w-2/3 animate-pulse rounded" />
        </div>
      ) : race ? (
        <>
          <p className="text-petroleum-700 font-medium">{race.title}</p>
          <p className="text-petroleum-400 mt-1 text-sm">
            {formatUpcomingDate(race.date)}
          </p>
          {race.location && (
            <p className="text-petroleum-400 text-sm">{race.location}</p>
          )}
          {race.distance_km != null && (
            <p className="text-petroleum-400 text-sm">{race.distance_km} km</p>
          )}
          <Link
            href={`/dashboard/races/${race.id}/edit`}
            className="text-petroleum-600 hover:text-petroleum-700 mt-3 inline-block text-xs font-medium underline-offset-2 hover:underline"
          >
            View race →
          </Link>
        </>
      ) : (
        <p className="text-petroleum-300 text-sm">No upcoming races.</p>
      )}
    </div>
  );
}

function UpcomingSessionCard({
  session,
  loading,
}: {
  session: UpcomingSession | null;
  loading: boolean;
}) {
  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className="bg-petroleum-50 flex size-7 items-center justify-center rounded-lg">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            className="text-petroleum-600"
          >
            <path
              d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h3 className="text-petroleum-700 text-sm font-semibold">
          Next Session
        </h3>
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="bg-sand-100 h-4 animate-pulse rounded" />
          <div className="bg-sand-100 h-3 w-2/3 animate-pulse rounded" />
        </div>
      ) : session ? (
        <>
          <p className="text-petroleum-700 font-medium">{session.title}</p>
          <p className="text-petroleum-400 mt-1 text-sm">
            {formatUpcomingDate(session.date)}
            {session.duration_minutes != null &&
              ` · ${session.duration_minutes} min`}
          </p>
          {session.speaker && (
            <p className="text-petroleum-400 text-sm">{session.speaker}</p>
          )}
          {session.location && (
            <p className="text-petroleum-400 text-sm">{session.location}</p>
          )}
          <Link
            href={`/dashboard/education/${session.id}/edit`}
            className="text-petroleum-600 hover:text-petroleum-700 mt-3 inline-block text-xs font-medium underline-offset-2 hover:underline"
          >
            View session →
          </Link>
        </>
      ) : (
        <p className="text-petroleum-300 text-sm">No upcoming sessions.</p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

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

  // Calendar
  const [view, setView] = useState<CalendarView>("month");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
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
        fromDate = toYMD(days[0]);
        toDate = toYMD(days[6]);
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
    setAnchor(d);
    setView("day");
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
                  onClick={() => setView(v)}
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
                onClick={() => setAnchor(navigateAnchor(view, anchor, -1))}
                className="text-petroleum-500 hover:bg-sand-100 flex size-7 items-center justify-center rounded-lg text-lg leading-none transition-colors"
              >
                ‹
              </button>
              <span className="text-petroleum-700 min-w-[148px] text-center text-sm font-medium">
                {periodLabel}
              </span>
              <button
                onClick={() => setAnchor(navigateAnchor(view, anchor, 1))}
                className="text-petroleum-500 hover:bg-sand-100 flex size-7 items-center justify-center rounded-lg text-lg leading-none transition-colors"
              >
                ›
              </button>
            </div>

            {/* Today */}
            <button
              onClick={() => setAnchor(new Date())}
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
