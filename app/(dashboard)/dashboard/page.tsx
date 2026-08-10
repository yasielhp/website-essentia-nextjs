"use client";

import { useState, useEffect, useReducer } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { insforge } from "@/lib/insforge";
import { useAuth } from "@/components/auth-provider";
import { useRole } from "@/context/role-context";
import { loadColorSettings, DEFAULT_COLORS } from "@/utils/color-settings";
import { Button } from "@/components/ui/button";
import { IconPlus, IconFilter } from "@/components/ui/icons";
import { CalendarFiltersModal } from "@/components/dashboard/calendar/calendar-filters-modal";
import {
  EMPTY_FILTERS,
  activeFilterCount,
  type CalendarFilters,
} from "@/utils/calendar-filters";
import type { CalendarView, CalendarEvent } from "@/types/calendar";
import { MonthGrid } from "@/components/dashboard/calendar/month-grid";
import { WeekGrid } from "@/components/dashboard/calendar/week-grid";
import { DayList } from "@/components/dashboard/calendar/day-list";
import { CalendarHeader } from "./calendar-header";
import { calNavReducer } from "./cal-nav";
import {
  toYMD,
  getWeekDays,
  groupByDate,
  formatPeriod,
  isPastDay,
  isPastSlot,
} from "@/utils/dashboard-calendar";
// ─── Calendar navigation reducer ─────────────────────────────

export default function DashboardPage() {
  const t = useTranslations("dashboard.calendar");
  const tTooltip = useTranslations("dashboard.calendar.tooltip");
  const tFilters = useTranslations("dashboard.calendar.filters");
  const tBookings = useTranslations("dashboard.bookings");
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
  // A booking whose owner has no name — still a booking, not a calendar hole.
  const bookedLabel = t("booked");
  // What a partner sees instead: taken, and nothing about by whom or why.
  const blockedLabel = t("blocked");

  // Filters. They narrow the query rather than the drawn events, so a month
  // with two hundred bookings does not have to be fetched to show three.
  const [filters, setFilters] = useState<CalendarFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [staffOptions, setStaffOptions] = useState<
    { id: string; name: string }[]
  >([]);
  const [tierOptions, setTierOptions] = useState<
    { id: string; label: string; service_id: string }[]
  >([]);

  useEffect(() => {
    async function loadFilterOptions() {
      const [staffRes, tiersRes] = await Promise.all([
        insforge.database
          .from("profiles")
          .select("id, full_name, first_name")
          .eq("role", "staff")
          .order("full_name"),
        insforge.database
          .from("service_tiers")
          .select("id, label, service_id")
          .eq("active", true)
          .order("sort_order"),
      ]);
      setStaffOptions(
        (
          (staffRes.data ?? []) as {
            id: string;
            full_name: string | null;
            first_name: string | null;
          }[]
        ).map((r) => ({ id: r.id, name: r.full_name ?? r.first_name ?? "—" })),
      );
      setTierOptions(
        (
          (tiersRes.data ?? []) as {
            id: string;
            label: string | null;
            service_id: string;
          }[]
        ).map((r) => ({
          id: r.id,
          label: r.label ?? "—",
          service_id: r.service_id,
        })),
      );
    }
    void loadFilterOptions();
  }, []);

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

  // Load all calendar events when view/anchor changes
  useEffect(() => {
    let cancelled = false;

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
          "id, date, time, service_id, service_title, tier_id, staff_id, duration, status, first_name, last_name",
        )
        .gte("date", fromDate)
        .lte("date", toDate)
        .order("time", { ascending: true });

      if (isPartner && user?.id) {
        bookingsQuery = bookingsQuery.eq("partner_id", user.id);
      }

      if (filters.staffId)
        bookingsQuery = bookingsQuery.eq("staff_id", filters.staffId);
      if (filters.serviceId)
        bookingsQuery = bookingsQuery.eq("service_id", filters.serviceId);
      if (filters.tierId)
        bookingsQuery = bookingsQuery.eq("tier_id", filters.tierId);

      // Races, sessions and calendar holes are not bookings, so no filter can
      // describe them: with one set, only the matching bookings are drawn.
      const filtering = !!(
        filters.staffId ||
        filters.serviceId ||
        filters.tierId
      );

      // A partner sees their own bookings and nothing else — not even a grey
      // block where somebody else's sits. The hours those occupy are refused
      // by `fetchAvailability` when a booking is made, which reads every
      // booking that professional has whoever entered it, so an empty square
      // here is not an offer.
      const [bookingsRes] = await Promise.all([bookingsQuery]);

      const [racesRes, sessionsRes] =
        isPartner || filtering
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

      // The calendar is read by colour, and a whole service in one colour says
      // nothing: every booking of Terapias Manuales looked alike. Colour comes
      // from the session type, which is unique per treatment, and only falls
      // back to the service when a booking has no type.
      const tierColors = new Map<string, string>();
      const tierLabels = new Map<string, string>();
      const tierIds = [
        ...new Set(
          ((bookingsRes.data ?? []) as Record<string, unknown>[])
            .map((b) => b.tier_id as string | null)
            .filter((id): id is string => !!id),
        ),
      ];
      if (tierIds.length > 0) {
        const { data: tierRows } = await insforge.database
          .from("service_tiers")
          .select("id, label, color")
          .in("id", tierIds);
        for (const row of (tierRows ?? []) as {
          id: string;
          label: string | null;
          color: string | null;
        }[]) {
          if (row.color) tierColors.set(row.id, row.color);
          if (row.label) tierLabels.set(row.id, row.label);
        }
      }

      const staffNames = new Map<string, string>();
      const staffIdsInView = [
        ...new Set(
          ((bookingsRes.data ?? []) as Record<string, unknown>[])
            .map((b) => b.staff_id as string | null)
            .filter((id): id is string => !!id),
        ),
      ];
      if (staffIdsInView.length > 0) {
        const { data: staffRows } = await insforge.database
          .from("profiles")
          .select("id, full_name, first_name")
          .in("id", staffIdsInView);
        for (const row of (staffRows ?? []) as {
          id: string;
          full_name: string | null;
          first_name: string | null;
        }[]) {
          staffNames.set(row.id, row.full_name ?? row.first_name ?? "—");
        }
      }

      const events: CalendarEvent[] = [];

      for (const b of (bookingsRes.data ?? []) as Record<string, unknown>[]) {
        const serviceId = b.service_id as string | null;
        const tierId = b.tier_id as string | null;
        const color =
          (tierId && tierColors.get(tierId)) ||
          (serviceId && settings.services[serviceId]) ||
          (serviceId && DEFAULT_COLORS.services[serviceId]) ||
          "#64748b";
        const name =
          [b.first_name, b.last_name].filter(Boolean).join(" ") ||
          (b.service_title as string) ||
          bookingFallback;
        const staffId = b.staff_id as string | null;
        // A pill only has room for a name; the rest goes in the hover card.
        const tooltip = [
          [b.time as string | null, b.duration as string | null]
            .filter(Boolean)
            .join(" · "),
          name,
          [
            b.service_title as string | null,
            tierId ? tierLabels.get(tierId) : null,
          ]
            .filter(Boolean)
            .join(" · "),
          staffId
            ? `${tTooltip("staff")}: ${staffNames.get(staffId) ?? "—"}`
            : tTooltip("noStaff"),
        ]
          .filter(Boolean)
          .join("\n");

        events.push({
          id: b.id as string,
          date: (b.date as string).slice(0, 10),
          time: b.time as string | null,
          title: name,
          // The treatment is what tells one booking from another; the service
          // is the same for a dozen of them.
          subtitle:
            (tierId ? tierLabels.get(tierId) : null) ??
            (b.service_title as string | undefined),
          tooltip,
          status: (b.status as string | null) ?? undefined,
          color,
          href: `/dashboard/bookings/${b.id}`,
          type: "booking",
        });
      }

      // Every slot already accounted for, so a booking that also lives on the
      // Google calendar is not drawn twice.
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

      if (cancelled) return;
      setCalendar({ loading: false, events });
    }
    void loadCalendar();

    return () => {
      cancelled = true;
    };
  }, [
    view,
    anchor,
    isPartner,
    user,
    bookingFallback,
    busyLabel,
    bookedByLabel,
    bookedLabel,
    blockedLabel,
    tTooltip,
    filters,
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
      <div className="grid grid-cols-1 gap-6 lg:px-10">
        {/* Actions — create on the left, filters on the right */}
        {!isPartner && (
          <div className="flex items-center justify-between gap-3 px-5 lg:px-0">
            <Button
              variant="solid"
              size="md"
              href="/dashboard/bookings/new"
              className="gap-2"
            >
              <IconPlus />
              {tBookings("createBooking")}
            </Button>

            <Button
              variant="outline"
              size="md"
              onClick={() => setFiltersOpen(true)}
              className="gap-2"
            >
              <IconFilter />
              {tFilters("title")}
              {activeFilterCount(filters) > 0 && (
                <span className="bg-petroleum-700 flex size-5 items-center justify-center rounded-full text-xs text-white">
                  {activeFilterCount(filters)}
                </span>
              )}
            </Button>
          </div>
        )}

        {/* Calendar */}
        <div className="border-sand-200 border-y bg-white lg:overflow-hidden lg:rounded-2xl lg:border">
          <CalendarHeader
            view={view}
            periodLabel={periodLabel}
            dispatchCalNav={dispatchCalNav}
          />

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
