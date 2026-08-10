import type { CalendarView } from "@/types/calendar";
import { navigateAnchor } from "@/utils/dashboard-calendar";

/**
 * Where the calendar is pointed, and how it moves.
 *
 * Its own file so the header can dispatch without importing the page.
 */
export type CalNav = { view: CalendarView; anchor: Date };

export type CalNavAction =
  | { type: "set-view"; view: CalendarView }
  | { type: "set-anchor"; anchor: Date }
  | { type: "nav"; delta: -1 | 1 };

export function calNavReducer(state: CalNav, action: CalNavAction): CalNav {
  switch (action.type) {
    case "set-view":
      return { ...state, view: action.view };
    case "set-anchor":
      return { ...state, anchor: action.anchor };
    case "nav":
      return {
        ...state,
        anchor: navigateAnchor(state.view, state.anchor, action.delta),
      };
  }
}
