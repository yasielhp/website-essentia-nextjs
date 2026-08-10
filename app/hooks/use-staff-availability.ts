"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDayFreeBusy } from "@/hooks/use-free-busy";
import { fetchAvailability, type Availability } from "@/actions/availability";
import { markBookedSlots } from "@/utils/calendar-helpers";
import { localDateStr } from "@/utils/format";

/**
 * What the chosen professional can actually take, month by month.
 *
 * The dashboard used to draw every future day and every hour of the day,
 * filtered only by the service's Google calendar — so it offered slots on days
 * the person does not work, and hours another of their sessions already had.
 * This is the same answer the public site gets, asked for one person.
 *
 * Both booking screens ask it, which is why it is a hook rather than eighty
 * lines repeated in each of them.
 */
export function useStaffAvailability({
  serviceId,
  tierId,
  staffId,
  selectedDate,
  durationMinutes,
}: {
  serviceId: string;
  tierId: string;
  staffId: string;
  selectedDate: Date | null;
  durationMinutes: number;
}) {
  const { busy: busyIntervals, loading: loadingSlots } = useDayFreeBusy(
    serviceId,
    selectedDate,
  );

  // The answer carries the question it answers, so a reply for the previous
  // professional is simply an answer nobody asked for any more — and nothing
  // has to be cleared from inside an effect to make that true.
  const [availability, setAvailability] = useState<{
    key: string;
    data: Availability;
  }>({ key: "", data: {} });
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const onMonthChange = useCallback((year: number, month: number) => {
    setMonth({ year, month });
  }, []);

  const key =
    tierId && staffId
      ? `${tierId}|${staffId}|${month.year}-${month.month}`
      : "";

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const { year, month: monthIndex } = month;
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    const mm = String(monthIndex + 1).padStart(2, "0");

    void fetchAvailability({
      tierId,
      staffId,
      from: `${year}-${mm}-01`,
      to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
      durationMinutes,
    }).then((result) => {
      if (!cancelled) setAvailability({ key, data: result });
    });

    return () => {
      cancelled = true;
    };
  }, [key, month, tierId, staffId, durationMinutes]);

  /** Only the answer to the question being asked; anything older is ignored. */
  const current = useMemo(
    () => (availability.key === key ? availability.data : {}),
    [availability, key],
  );

  const openDates = useMemo(
    () =>
      // One pass: a day with no free hour never becomes an entry to discard.
      new Set(
        Object.entries(current).flatMap(([date, times]) =>
          times.length > 0 ? [date] : [],
        ),
      ),
    [current],
  );

  /**
   * The hours this person can actually start at.
   *
   * These come straight from `fetchAvailability`, which already knows their
   * working day, their slot interval, their other bookings and their own
   * Google Calendar. They used to be filtered against a fixed grid that landed
   * on the hour, so a professional working 10:00–13:00 with a 15-minute
   * interval was offered as 10:00 and 11:00 — two of the nine starts she
   * actually had. The grid decided the shape of the day; the schedule only got
   * to veto it.
   *
   * The service's own calendar still marks a slot taken, which is all it was
   * ever entitled to say.
   */
  const timeSlots = selectedDate
    ? markBookedSlots(
        selectedDate,
        current[localDateStr(selectedDate)] ?? [],
        durationMinutes,
        busyIntervals,
      )
    : [];

  return { month, onMonthChange, openDates, timeSlots, loadingSlots };
}
