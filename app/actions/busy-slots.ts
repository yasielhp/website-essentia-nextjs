"use server";

import { getAdminClient } from "@/lib/insforge-admin";
import { AuthError, requireRole } from "@/lib/auth-guard";
import {
  getFreeBusy,
  getStaffServiceAccessToken,
  getValidAccessToken,
} from "@/lib/google-calendar";
import {
  listConnectedServices,
  listStaffWithCalendar,
} from "@/services/calendar-config.service";
import type { BusySlot } from "@/types/calendar";

/**
 * Occupied slots for the dashboard overview calendar.
 *
 * Partners may only read their own bookings (`partners_read_own_bookings` RLS),
 * so an admin-created appointment leaves a hole in their calendar and the slot
 * looks free. This reads every booking with the service key and returns only
 * date, time, duration and who booked it — never the client's name, email,
 * phone, service or id.
 *
 * `bookedBy` names the owner only when that owner is another partner, so a
 * partner can tell a colleague's appointment from an opaque block. Bookings
 * owned by admin or staff stay anonymous — internal staffing is none of a
 * partner's business — and so does anyone with no name on their profile.
 *
 * The caller's own bookings are left out: those already arrive through the
 * partner's own query, with full detail.
 */
const YMD = /^\d{4}-\d{2}-\d{2}$/;

type BookingRow = {
  date: string | null;
  time: string | null;
  duration: string | null;
  status: string | null;
  partner_id: string | null;
  created_by_user_id: string | null;
};

type ProfileRow = {
  id: string;
  role: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

function displayName(profile: ProfileRow): string | null {
  const parts = [profile.first_name, profile.last_name].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  return profile.full_name?.trim() || null;
}

export async function fetchBusySlots(
  accessToken: string | null,
  fromDate: string,
  toDate: string,
): Promise<BusySlot[]> {
  let caller;
  try {
    caller = await requireRole(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return [];
    throw err;
  }

  if (!YMD.test(fromDate) || !YMD.test(toDate)) return [];

  const db = getAdminClient().database;

  const { data } = await db
    .from("bookings")
    .select("date, time, duration, status, partner_id, created_by_user_id")
    .gte("date", fromDate)
    .lte("date", toDate)
    .order("time", { ascending: true });

  const rows = ((data ?? []) as BookingRow[]).filter(
    (row) =>
      row.date !== null &&
      row.status !== "cancelled" &&
      row.partner_id !== caller.userId,
  );

  // One lookup for every owner in the range rather than one per booking.
  const ownerIds = [
    ...new Set(
      rows
        .map((row) => row.created_by_user_id ?? row.partner_id)
        .filter((id): id is string => id !== null),
    ),
  ];

  const names = new Map<string, string>();
  if (ownerIds.length > 0) {
    const { data: profiles } = await db
      .from("profiles")
      .select("id, role, full_name, first_name, last_name")
      .in("id", ownerIds);

    for (const profile of (profiles ?? []) as ProfileRow[]) {
      if (profile.role !== "partner") continue;
      const name = displayName(profile);
      if (name) names.set(profile.id, name);
    }
  }

  return rows.map((row) => {
    const ownerId = row.created_by_user_id ?? row.partner_id;
    return {
      date: row.date!.slice(0, 10),
      time: row.time,
      duration: row.duration,
      bookedBy: ownerId ? (names.get(ownerId) ?? null) : null,
    };
  });
}

/**
 * Busy intervals from the connected Google calendars over the same range.
 *
 * These are the blocks that are genuinely "busy" rather than "booked by": an
 * event somebody put on the centre's calendar directly, with no booking behind
 * it. Returned as raw ISO pairs so the browser converts them to its own clock,
 * exactly like the booking flow does with `/api/google/calendar/freebusy`.
 *
 * Fails open — an unreachable calendar leaves the overview as it was.
 */
export async function fetchCalendarBusy(
  accessToken: string | null,
  fromDate: string,
  toDate: string,
): Promise<{ start: string; end: string }[]> {
  try {
    await requireRole(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return [];
    throw err;
  }

  if (!YMD.test(fromDate) || !YMD.test(toDate)) return [];

  const timeMax = `${toDate}T23:59:59Z`;

  try {
    const serviceIds = await listConnectedServices();

    const groups = await Promise.all(
      serviceIds.map(async (serviceId) => {
        const [serviceToken, staffIds] = await Promise.all([
          getValidAccessToken(serviceId),
          listStaffWithCalendar(serviceId),
        ]);

        const calendars = await Promise.all([
          serviceToken
            ? getFreeBusy(serviceToken, "primary", fromDate, timeMax)
            : Promise.resolve([]),
          ...staffIds.map(async (staffId) => {
            const token = await getStaffServiceAccessToken(staffId, serviceId);
            return token
              ? getFreeBusy(token, "primary", fromDate, timeMax)
              : [];
          }),
        ]);

        return calendars.flat();
      }),
    );

    // The same event reaches us once per calendar it is shared with.
    const seen = new Set<string>();
    return groups.flat().filter(({ start, end }) => {
      const key = `${start}|${end}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch (err) {
    console.error("[busy-slots] fetchCalendarBusy:", err);
    return [];
  }
}
