import { getAdminClient } from "@/lib/insforge-admin";
import {
  BONUS_LOST,
  BONUS_RETURNED,
  lostBookingIds,
  useStatus,
} from "./cancellation";

/**
 * SERVER ONLY. The bookings that drew on these bonuses, with a session lost
 * under the 24-hour rule reported as status `lost` (counted as used by
 * `bonusBalance`). The history is read only for the cancelled ones. A history
 * that cannot be read loses nobody's session: they count as returned, as
 * before the rule, and it is logged.
 */
export type BonusUseRow = {
  id: string;
  bonus_id: string;
  date: string | null;
  time: string | null;
  status: string;
};

export async function readBonusUses(
  bonusIds: string[],
): Promise<BonusUseRow[]> {
  if (bonusIds.length === 0) return [];
  const db = getAdminClient().database;
  const { data } = await db
    .from("bookings")
    .select("id, date, time, status, bonus_id")
    .in("bonus_id", bonusIds)
    .order("date", { ascending: true });
  const rows = (data ?? []) as {
    id: string;
    date: string | null;
    time: string | null;
    status: string | null;
    bonus_id: string;
  }[];

  const cancelled = rows
    .filter((r) => r.status === "cancelled")
    .map((r) => r.id);
  let lost = new Set<string>();
  if (cancelled.length > 0) {
    const { data: entries, error } = await db
      .from("booking_events")
      .select("booking_id, event, created_at")
      .in("booking_id", cancelled)
      .in("event", [BONUS_LOST, BONUS_RETURNED]);
    if (error) {
      console.error("[bonuses] lost sessions unreadable:", error);
    } else {
      lost = lostBookingIds(
        (entries ?? []) as {
          booking_id: string | null;
          event: string;
          created_at: string;
        }[],
      );
    }
  }

  return rows.map((r) => ({
    id: r.id,
    bonus_id: r.bonus_id,
    date: r.date,
    time: r.time,
    status: useStatus(r, lost),
  }));
}
