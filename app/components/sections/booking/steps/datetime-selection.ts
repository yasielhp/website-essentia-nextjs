import type { Availability } from "@/actions/availability";
import { localDateStr } from "@/utils/format";

type Month = { year: number; month: number };

/** Whether the list in hand is the one for the month of this day. */
const coversDay = (loaded: Month, date: Date) =>
  date.getFullYear() === loaded.year && date.getMonth() === loaded.month;

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
  loaded: Month;
  date: Date | null;
  time: string | null;
}): boolean {
  if (!date || !time) return false;
  if (!coversDay(loaded, date)) return false;
  return !(availability[localDateStr(date)] ?? []).includes(time);
}

/**
 * Whether the chosen day and hour have been seen in the list for that day.
 *
 * It is what "next" waits for. A day and an hour in the form are not enough: a
 * restored booking has both before any list has arrived, and the list queues
 * behind the consent writes of the previous step, so there are seconds in
 * which the button would let an unchecked hour through. `loaded` is null until
 * a list arrives.
 */
export function selectionVerified({
  availability,
  loaded,
  date,
  time,
}: {
  availability: Availability;
  loaded: Month | null;
  date: Date | null;
  time: string | null;
}): boolean {
  if (!date || !time || !loaded) return false;
  if (!coversDay(loaded, date)) return false;
  return (availability[localDateStr(date)] ?? []).includes(time);
}
