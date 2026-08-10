/**
 * What the calendar is filtered by, and what counts as filtered.
 *
 * Plain values, kept out of the modal that edits them: a component file that
 * also exports constants cannot keep its state across a Fast Refresh.
 */
export type CalendarFilters = {
  staffId: string;
  serviceId: string;
  tierId: string;
};

export const EMPTY_FILTERS: CalendarFilters = {
  staffId: "",
  serviceId: "",
  tierId: "",
};

export function activeFilterCount(filters: CalendarFilters): number {
  return Object.values(filters).filter(Boolean).length;
}
