"use client";

import { useTranslations } from "next-intl";
import { formatCalendarDay, type SupportedLocale } from "@/utils/format";
import type {
  LocationAddress,
  LocationOption,
} from "../_shared/location-options";

/**
 * A finished step in one line.
 *
 * Once a step is answered it folds into a summary, and what that summary says
 * is not the same as what the step asked: "Baobab Suites" becomes the
 * reservation and room actually typed, and a date and hour become one phrase.
 */
export function useStepLabels({
  location,
  allowedLocations,
  reservationNumber,
  roomNumber,
  address,
  selectedDate,
  selectedTime,
  locale,
}: {
  location: string;
  allowedLocations: LocationOption[];
  reservationNumber: string;
  roomNumber: string;
  address: LocationAddress;
  selectedDate: Date | null;
  selectedTime: string;
  locale: SupportedLocale;
}) {
  const t = useTranslations("dashboard.bookings.form");

  const base = allowedLocations.find((l) => l.id === location)?.label ?? "";
  const locationLabel = (() => {
    if (location === "centro" || location === "habitacion") {
      const parts: string[] = [];
      if (reservationNumber.trim())
        parts.push(
          t("locations.reservationSummary", {
            number: reservationNumber.trim(),
          }),
        );
      if (roomNumber.trim())
        parts.push(t("locations.roomSummary", { number: roomNumber.trim() }));
      return parts.length ? parts.join(" · ") : base;
    }
    if (location === "domicilio") {
      const parts: string[] = [];
      if (address.street.trim()) parts.push(address.street.trim());
      if (address.postalCode.trim() || address.municipality.trim())
        parts.push(
          [address.postalCode.trim(), address.municipality.trim()]
            .filter(Boolean)
            .join(" "),
        );
      return parts.length ? parts.join(" · ") : base;
    }
    return base;
  })();

  const shortDay = selectedDate
    ? formatCalendarDay(selectedDate, locale, {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    : "";
  const datetimeLabel = !selectedDate
    ? ""
    : selectedTime
      ? `${shortDay} · ${selectedTime}`
      : shortDay;

  return { locationLabel, datetimeLabel };
}
