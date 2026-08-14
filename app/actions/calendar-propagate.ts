"use server";

import { AuthError, requireRole } from "@/lib/auth-guard";
import {
  removeBookingFromCalendars,
  updateBookingOnCalendars,
} from "@/lib/calendar-propagate";
import { pushBookingToCalendars } from "@/lib/calendar-sync";
import {
  actorFromToken,
  recordBookingEvent,
} from "@/lib/booking-events/record";
import { getAdminClient } from "@/lib/insforge-admin";

/**
 * Whose agenda this booking belongs to, for the line the history shows.
 *
 * A booking can sit on three calendars at once — the service's, the
 * professional's, and every administrator's mirror — and naming all of them
 * would say less than naming none. The professional is the one a person
 * reading the trail is asking about. `bookings.staff_id` points at
 * `auth.users` and not at `profiles`, so the name needs its own read.
 */
async function calendarOwnerName(bookingId: string): Promise<string | null> {
  const db = getAdminClient().database;

  const { data: booking } = await db
    .from("bookings")
    .select("staff_id")
    .eq("id", bookingId)
    .maybeSingle();

  const staffId = (booking as { staff_id: string | null } | null)?.staff_id;
  if (!staffId) return null;

  const { data: profile } = await db
    .from("profiles")
    .select("first_name, full_name")
    .eq("id", staffId)
    .maybeSingle();

  const person = profile as {
    first_name: string | null;
    full_name: string | null;
  } | null;

  return person?.full_name?.trim() || person?.first_name?.trim() || null;
}

function calendarSummary(what: string, owner: string | null): string {
  return owner ? `${what} · agenda de ${owner}` : what;
}

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

  const [actor, owner] = await Promise.all([
    actorFromToken(accessToken),
    calendarOwnerName(bookingId),
  ]);

  const removing = action === "removed";
  // One entry for the whole propagation rather than one per calendar: the
  // trail is read by a person, who wants to know the change travelled — not
  // which Google account each copy of it landed in.
  const entry = {
    bookingId,
    channel: "calendar" as const,
    event: removing ? ("removed" as const) : ("synced" as const),
    summary: calendarSummary(
      removing ? "Cita retirada del calendario" : "Calendario actualizado",
      owner,
    ),
    ...actor,
  };

  try {
    if (removing) {
      await removeBookingFromCalendars(bookingId);
    } else {
      await updateBookingOnCalendars(bookingId);
    }
  } catch (err) {
    // Neither of those throws today — a calendar that refuses is logged and
    // the rest still change. If one ever does, the history says so instead of
    // the change vanishing, and the error travels on so the caller behaves
    // exactly as it did before.
    await recordBookingEvent({
      ...entry,
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  await recordBookingEvent(entry);
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

  const [actor, owner] = await Promise.all([
    actorFromToken(accessToken),
    calendarOwnerName(bookingId),
  ]);

  // "Sincronizado" and not "añadida": the push skips a booking that is still a
  // draft, one already on the calendar and one whose date has passed, and it
  // reports back nothing, so the honest claim is that the sync ran.
  const entry = {
    bookingId,
    channel: "calendar" as const,
    event: "synced" as const,
    summary: calendarSummary("Calendario sincronizado", owner),
    ...actor,
  };

  try {
    await pushBookingToCalendars(bookingId);
  } catch (err) {
    await recordBookingEvent({
      ...entry,
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  await recordBookingEvent(entry);
}
