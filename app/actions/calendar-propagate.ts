"use server";

import { AuthError, requireRole } from "@/lib/auth-guard";
import {
  removeBookingFromCalendars,
  updateBookingOnCalendars,
} from "@/lib/calendar-propagate";
import { pushBookingToCalendars } from "@/lib/calendar-sync";

/**
 * The dashboard's way of saying "this booking changed, fix the calendars".
 *
 * The pages that edit a booking are Client Components, so they need an action;
 * the work itself is server-side and shared with the cancellation link, which
 * has no session at all.
 */
export async function syncBookingToCalendars(
  accessToken: string | null,
  bookingId: string,
  action: "updated" | "removed",
): Promise<void> {
  try {
    await requireRole(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return;
    throw err;
  }

  if (action === "removed") {
    await removeBookingFromCalendars(bookingId);
  } else {
    await updateBookingOnCalendars(bookingId);
  }
}

/**
 * "This booking is real now — put it on the calendars."
 *
 * Its twin above corrects the copies a booking already has; this one creates
 * the ones it is missing. Both exist because the dashboard screens are Client
 * Components and the work is server-side.
 */
export async function pushBookingToCalendarsAction(
  accessToken: string | null,
  bookingId: string,
): Promise<void> {
  try {
    await requireRole(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return;
    throw err;
  }

  await pushBookingToCalendars(bookingId);
}
