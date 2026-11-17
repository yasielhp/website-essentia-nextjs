import type { SegmentConditions } from "@/types/campaign";

/**
 * The two kinds of segment, decided from what is stored. A saved FILTER is
 * dynamic: whoever meets the conditions, today or later. A hand-made LIST is
 * fixed: only the people picked, whether or not they meet anything. Nothing new
 * in the database: both live in `conditions`, a segment saved before lists
 * existed has neither key and is a filter, and behaves exactly as it did.
 */
export type SegmentKind = "filter" | "list";

/** The most people a hand-made list holds; the schema and the screen read this one number. */
export const MAX_LIST_PEOPLE = 2000;

export function segmentKindOf(
  conditions: Pick<SegmentConditions, "manualIds" | "manualOnly">,
): SegmentKind {
  return conditions.manualOnly === true &&
    (conditions.manualIds?.length ?? 0) > 0
    ? "list"
    : "filter";
}

/** The conditions of a segment that is only a list of people: nothing narrows it. */
const NEUTRAL = {
  language: "any",
  newsletter: null,
  services: [],
  lastBooking: null,
  neverBooked: false,
  hasBooked: false,
} as const;

/**
 * What a save stores. A list keeps its people (once each) and every other
 * condition at its neutral value, because the filter was only how they were
 * found; a filter keeps its conditions and no list.
 */
export function normalizeSegmentConditions(
  conditions: SegmentConditions,
): SegmentConditions {
  if (segmentKindOf(conditions) === "list") {
    return {
      ...NEUTRAL,
      services: [],
      manualIds: [...new Set(conditions.manualIds)],
      manualOnly: true,
    };
  }
  const { manualIds: _ids, manualOnly: _only, ...filter } = conditions;
  void _ids;
  void _only;
  return filter;
}
