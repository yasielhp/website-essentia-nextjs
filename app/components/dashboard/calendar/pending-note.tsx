"use client";

import { useTranslations } from "next-intl";
import type { CalendarEvent } from "@/types/calendar";
import { isPendingEvent } from "@/utils/calendar-status";

/**
 * "Pending", for a screen reader, on a booking that waits for payment or for
 * the team. A dashed outline and stripes are all a sighted person gets from the
 * block itself; the word is read after the name. Nothing for any other event.
 */
export function PendingNote({ event }: { event: CalendarEvent }) {
  const t = useTranslations("dashboard.bookings.status");
  if (!isPendingEvent(event)) return null;
  return <span className="sr-only">, {t("pending")}</span>;
}

/** The hover text of a pending booking (its tooltip, which says the status); none for any other. */
export function pendingTitle(event: CalendarEvent): string | undefined {
  return isPendingEvent(event) ? event.tooltip : undefined;
}
