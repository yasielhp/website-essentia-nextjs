"use client";

import { useEffect, useState } from "react";

export type BusyInterval = { start: string; end: string };

/**
 * Live availability for a service, from Google Calendar.
 *
 * This has to run in the browser, and it is not the "page fetches its data on
 * mount" shape it resembles: the service and the day come from choices the
 * visitor makes *in the form*, after the page is already on screen, and the
 * answer is what is booked right now. Rendering it on the server would mean
 * showing an availability grid built before the visitor picked anything, and
 * serving a cached one means offering an hour somebody already took.
 *
 * Three copies of this lived inside two route files. One copy, in a hook.
 */
type FreeBusyState = {
  /** The query these intervals answer; `null` before the first one lands. */
  key: string | null;
  busy: BusyInterval[];
};

const EMPTY: FreeBusyState = { key: null, busy: [] };

/**
 * `loading` is derived, not stored.
 *
 * A boolean flag has to be cleared on every path out of the request, and a
 * path that forgets leaves a spinner running for good. Comparing the answer we
 * hold against the question being asked cannot get stuck: a stale reply is
 * simply an answer to a question nobody asked any more.
 */
function useFreeBusy(query: string | null): {
  busy: BusyInterval[];
  loading: boolean;
} {
  const [state, setState] = useState<FreeBusyState>(EMPTY);

  useEffect(() => {
    if (!query) return;
    let cancelled = false;

    void (async () => {
      let busy: BusyInterval[] = [];
      try {
        const response = await fetch(`/api/google/calendar/freebusy?${query}`);
        // `fetch` resolves on 4xx/5xx, and the error body carries no `busy`,
        // so an unchecked read would say "nothing is booked" during an outage.
        if (response.ok) {
          const json = (await response.json()) as { busy?: BusyInterval[] };
          busy = json.busy ?? [];
        }
      } catch {
        // Fail open: the centre would rather field a double booking than turn
        // away a visitor because Google was unreachable.
      }
      if (!cancelled) setState({ key: query, busy });
    })();

    return () => {
      cancelled = true;
    };
  }, [query]);

  return {
    busy: state.key === query ? state.busy : [],
    loading: Boolean(query) && state.key !== query,
  };
}

/** Everything booked in one month, for greying out full days. */
export function useMonthFreeBusy(
  serviceId: string | null,
  viewYear: number,
  viewMonth: number,
) {
  const month = String(viewMonth + 1).padStart(2, "0");
  const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();
  const query = serviceId
    ? `service_id=${serviceId}&start=${viewYear}-${month}-01&end=${viewYear}-${month}-${String(lastDay).padStart(2, "0")}`
    : null;

  return useFreeBusy(query);
}

/** Everything booked on one day, for the time slots. */
export function useDayFreeBusy(serviceId: string | null, date: Date | null) {
  const query =
    serviceId && date
      ? `service_id=${serviceId}&date=${date.getFullYear()}-${String(
          date.getMonth() + 1,
        ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
      : null;

  return useFreeBusy(query);
}
