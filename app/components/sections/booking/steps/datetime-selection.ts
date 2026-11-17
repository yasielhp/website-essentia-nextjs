import type { Availability } from "@/actions/availability";
import { localDateStr } from "@/utils/format";

/**
 * Whether an hour chosen earlier is no longer on offer, now that the list for
 * its month has arrived.
 *
 * A booking picked up again brings its day and hour with it, and "next" would
 * be open on an hour somebody else took meanwhile, or on one that has passed.
 * The list is the only thing that knows, so the choice is checked against it.
 * Only against the list of ITS OWN month: the calendar loads one month at a
 * time, and another month's list says nothing about her day.
 */
export function selectionGone({
  availability,
  loaded,
  date,
  time,
}: {
  availability: Availability;
  /** The month the list is for; `month` as `Date` counts it, from 0. */
  loaded: { year: number; month: number };
  date: Date | null;
  time: string | null;
}): boolean {
  if (!date || !time) return false;
  if (date.getFullYear() !== loaded.year || date.getMonth() !== loaded.month) {
    return false;
  }
  return !(availability[localDateStr(date)] ?? []).includes(time);
}
