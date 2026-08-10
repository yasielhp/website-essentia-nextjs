"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { IconPlus, IconFilter } from "@/components/ui/icons";
import {
  activeFilterCount,
  type CalendarFilters,
} from "@/utils/calendar-filters";

/**
 * Create on the left, filter on the right.
 *
 * A partner sees neither: they cannot take a booking from here, and there is
 * nothing of anybody else's to filter out of their own.
 */
export function DashboardActions({
  filters,
  onOpenFilters,
}: {
  filters: CalendarFilters;
  onOpenFilters: () => void;
}) {
  const tBookings = useTranslations("dashboard.bookings");
  const tFilters = useTranslations("dashboard.calendar.filters");
  const active = activeFilterCount(filters);

  return (
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
        onClick={onOpenFilters}
        className="gap-2"
      >
        <IconFilter />
        {tFilters("title")}
        {active > 0 && (
          <span className="bg-petroleum-700 flex size-5 items-center justify-center rounded-full text-xs text-white">
            {active}
          </span>
        )}
      </Button>
    </div>
  );
}
