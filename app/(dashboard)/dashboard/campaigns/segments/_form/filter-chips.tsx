"use client";

import { useTranslations } from "next-intl";
import { bookableServices } from "@/data/services-data";
import {
  activeFilters,
  type ActiveFilter,
  type FilterId,
  type SegmentFilters,
} from "@/lib/campaigns/segment-people";

/**
 * The filters that are on, as chips that come off with a click, and the way to
 * take them all off. Nothing is drawn when no filter is on.
 */
export function FilterChips({
  filters,
  onRemove,
  onClear,
}: {
  filters: SegmentFilters;
  onRemove: (id: FilterId) => void;
  onClear: () => void;
}) {
  const t = useTranslations("dashboard.campaigns.segments.form");
  const tAudience = useTranslations("dashboard.campaigns.audience");
  const chips = activeFilters(filters);
  if (chips.length === 0) return null;

  const text = (chip: ActiveFilter): string => {
    switch (chip.id) {
      case "language":
        return `${tAudience("language")}: ${tAudience(chip.value === "es" ? "languageEs" : "languageEn")}`;
      case "subscription":
        return `${tAudience("subscription")}: ${tAudience("subscriptionOnly")}`;
      case "bookings":
        return `${tAudience("bookings")}: ${tAudience(chip.value === "never" ? "bookingsNever" : "bookingsBooked")}`;
      case "services":
        return t("chipServices", {
          value: chip.value
            .map((id) => bookableServices.find((s) => s.id === id)?.title ?? id)
            .join(", "),
        });
      case "lastBooking":
        return t("chipLastBooking", {
          op: chip.value.op,
          days: chip.value.days,
        });
    }
  };

  return (
    <ul aria-label={t("chips")} className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <li key={chip.id}>
          <button
            type="button"
            onClick={() => onRemove(chip.id)}
            aria-label={t("chipRemove", { name: text(chip) })}
            className="bg-sand-100 text-petroleum-700 hover:bg-sand-200 focus-visible:ring-petroleum-500 inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium focus-visible:ring-2 focus-visible:outline-none"
          >
            {text(chip)}
            <span aria-hidden="true">✕</span>
          </button>
        </li>
      ))}
      <li>
        <button
          type="button"
          onClick={onClear}
          className="text-petroleum-500 hover:text-petroleum-700 min-h-8 px-2 text-xs underline underline-offset-2"
        >
          {t("clearFilters")}
        </button>
      </li>
    </ul>
  );
}
