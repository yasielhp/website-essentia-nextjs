"use client";

import { useEffect, useState } from "react";
import { insforge } from "@/lib/insforge";
import type { CalendarView, CalendarEvent } from "@/types/calendar";
import type { CalendarFilters } from "@/utils/calendar-filters";
import { loadCalendarEvents, type EventLabels } from "./calendar-events";

/**
 * What the filter modal can offer: every professional, and every session type.
 *
 * Fetched once — the lists do not change while somebody is looking at a month.
 */
export function useFilterOptions() {
  const [staffOptions, setStaffOptions] = useState<
    { id: string; name: string }[]
  >([]);
  const [tierOptions, setTierOptions] = useState<
    { id: string; label: string; service_id: string }[]
  >([]);

  useEffect(() => {
    async function load() {
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
    void load();
  }, []);

  return { staffOptions, tierOptions };
}

/**
 * The events on show, refetched whenever the month, the filters or the viewer
 * changes.
 *
 * `labels` is passed in already resolved rather than as a translator: `t` is
 * not guaranteed to be referentially stable, and as a dependency it would
 * refetch the calendar on renders that changed nothing.
 */
export function useCalendarEvents({
  view,
  anchor,
  isPartner,
  userId,
  filters,
  labels,
}: {
  view: CalendarView;
  anchor: Date;
  isPartner: boolean;
  userId: string | undefined;
  filters: CalendarFilters;
  labels: EventLabels;
}) {
  const [calendar, setCalendar] = useState<{
    loading: boolean;
    events: CalendarEvent[];
  }>({ loading: true, events: [] });

  const { bookingFallback, staff, noStaff } = labels;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const events = await loadCalendarEvents({
        view,
        anchor,
        isPartner,
        userId,
        filters,
        labels: { bookingFallback, staff, noStaff },
      });
      if (cancelled) return;
      setCalendar({ loading: false, events });
    }
    void load();

    return () => {
      cancelled = true;
    };
  }, [
    view,
    anchor,
    isPartner,
    userId,
    filters,
    bookingFallback,
    staff,
    noStaff,
  ]);

  return calendar;
}
