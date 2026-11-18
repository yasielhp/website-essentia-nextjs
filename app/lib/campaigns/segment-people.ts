import type {
  CampaignAudience,
  SegmentConditions,
  SegmentPerson,
} from "@/types/campaign";
import { conditionsMatch } from "./conditions";
import {
  MAX_LIST_PEOPLE,
  normalizeSegmentConditions,
} from "./segment-conditions";
import type { ContactCandidate } from "./audience-filter";

/**
 * What the screen where a segment is made decides, over plain values: who is
 * shown, how the selection behaves while the filters and the search change, which
 * filters are on, what is saved and whether anything changed. Nothing here knows
 * about React or the database; the filters use the engine's own rule
 * (`conditionsMatch`), so what is filtered on screen is what a send resolves.
 */

/** The filters of a segment, as the dialog edits them. */
export type SegmentFilters = Pick<
  CampaignAudience,
  | "language"
  | "newsletter"
  | "services"
  | "lastBooking"
  | "neverBooked"
  | "hasBooked"
>;

export function toSegmentPerson(
  candidate: Pick<
    ContactCandidate,
    | "id"
    | "email"
    | "firstName"
    | "lastName"
    | "phone"
    | "language"
    | "newsletter"
    | "bouncedAt"
    | "unsubscribedAt"
    | "lastBookingDate"
    | "serviceIds"
    | "bookingsCount"
    | "whatsappOptedOutAt"
    | "whatsappUnreachableAt"
  >,
): SegmentPerson {
  return {
    id: candidate.id,
    firstName: candidate.firstName,
    lastName: candidate.lastName ?? null,
    email: candidate.email,
    phone: candidate.phone ?? null,
    language: candidate.language,
    newsletter: candidate.newsletter,
    serviceIds: candidate.serviceIds,
    bookingsCount: candidate.bookingsCount,
    lastBookingDate: candidate.lastBookingDate,
    // An unsubscribe is the person's own word: it says more than a bounce.
    emailIssue: candidate.unsubscribedAt
      ? "unsubscribed"
      : candidate.bouncedAt
        ? "bounced"
        : null,
    whatsappIssue: candidate.whatsappOptedOutAt
      ? "stopped"
      : candidate.whatsappUnreachableAt
        ? "unreachable"
        : null,
  };
}

export function personName(
  person: Pick<SegmentPerson, "firstName" | "lastName">,
) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ") || "—";
}

const plain = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Name, email or phone contains the term: case, accents and spacing do not matter. */
export function searchMatches(person: SegmentPerson, term: string): boolean {
  const needle = plain(term.trim());
  if (needle === "") return true;
  const text = plain(`${personName(person)} ${person.email}`);
  if (text.includes(needle)) return true;
  const digits = needle.replace(/\D/g, "");
  return (
    digits !== "" && (person.phone ?? "").replace(/\D/g, "").includes(digits)
  );
}

/**
 * Who the table shows: the people who meet the filters and the search.
 */
export function visiblePeople({
  people,
  filters,
  search,
  now,
}: {
  people: SegmentPerson[];
  filters: SegmentFilters;
  search: string;
  now: Date;
}): SegmentPerson[] {
  return people.filter((person) => {
    if (!searchMatches(person, search)) return false;
    return conditionsMatch(person, { ...filters, manualIds: [] }, now);
  });
}

/**
 * One person picked or taken off. A list holds at most `MAX_LIST_PEOPLE`: past
 * that the pick is not made (the screen says so), so the save can never be
 * refused for a number the person had no way to see.
 */
export function toggleOne(
  selected: ReadonlySet<string>,
  id: string,
): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else if (next.size < MAX_LIST_PEOPLE) next.add(id);
  return next;
}

/** Whether the list is as big as it can be. */
export function listIsFull(selected: ReadonlySet<string>): boolean {
  return selected.size >= MAX_LIST_PEOPLE;
}

export type HeaderCheck = "none" | "some" | "all";

/** The header checkbox: none, some or all of the people listed are selected. */
export function headerCheckState(
  selected: ReadonlySet<string>,
  visibleIds: string[],
): HeaderCheck {
  if (visibleIds.length === 0) return "none";
  const count = visibleIds.filter((id) => selected.has(id)).length;
  return count === 0 ? "none" : count === visibleIds.length ? "all" : "some";
}

/**
 * The header checkbox's click, over everyone the table lists (every page of the
 * filters and the search in force): when all of them are selected it un-selects
 * them, otherwise it selects them. Whoever is selected but not listed (hidden by
 * a filter or the search) is never touched.
 */
export function toggleVisible(
  selected: ReadonlySet<string>,
  visibleIds: string[],
): Set<string> {
  const next = new Set(selected);
  if (visibleIds.length === 0) return next;
  if (headerCheckState(selected, visibleIds) === "all") {
    for (const id of visibleIds) next.delete(id);
  } else {
    // Only as many as the list has room for; the rest are left unpicked.
    for (const id of visibleIds) {
      if (next.size >= MAX_LIST_PEOPLE) break;
      next.add(id);
    }
  }
  return next;
}

export type FilterId =
  "language" | "subscription" | "bookings" | "services" | "lastBooking";

export type ActiveFilter =
  | { id: "language"; value: "es" | "en" }
  | { id: "subscription" }
  | { id: "bookings"; value: "booked" | "never" }
  | { id: "services"; value: string[] }
  | { id: "lastBooking"; value: { op: "gt" | "lt"; days: number } };

/** The filters that are on, in the order the dialog lists them. */
export function activeFilters(filters: SegmentFilters): ActiveFilter[] {
  const out: ActiveFilter[] = [];
  if (filters.language !== "any") {
    out.push({ id: "language", value: filters.language });
  }
  if (filters.newsletter === true) out.push({ id: "subscription" });
  if (filters.neverBooked) out.push({ id: "bookings", value: "never" });
  else if (filters.hasBooked) out.push({ id: "bookings", value: "booked" });
  if (filters.services.length > 0) {
    out.push({ id: "services", value: filters.services });
  }
  if (filters.lastBooking) {
    out.push({ id: "lastBooking", value: filters.lastBooking });
  }
  return out;
}

/** Edits to the filters; "never booked" cannot hold beside a booking condition. */
export function applyFilterPatch(
  filters: SegmentFilters,
  patch: Partial<SegmentFilters>,
): SegmentFilters {
  const next = { ...filters, ...patch };
  if (next.neverBooked) {
    next.services = [];
    next.lastBooking = null;
    next.hasBooked = false;
  }
  return next;
}

/** One filter taken off, and no other. */
export function removeFilter(
  filters: SegmentFilters,
  id: FilterId,
): SegmentFilters {
  switch (id) {
    case "language":
      return { ...filters, language: "any" };
    case "subscription":
      return { ...filters, newsletter: null };
    case "bookings":
      return { ...filters, neverBooked: false, hasBooked: false };
    case "services":
      return { ...filters, services: [] };
    case "lastBooking":
      return { ...filters, lastBooking: null };
  }
}

/**
 * The sentence that says what the segment is. Nobody picked: a filter, which
 * keeps including whoever meets it later. People picked: a list, only them.
 */
export function segmentSentence(
  selectedCount: number,
  matchingCount: number,
): { key: "filter" | "list"; count: number } {
  return selectedCount > 0
    ? { key: "list", count: selectedCount }
    : { key: "filter", count: matchingCount };
}

/** What is stored: a list (people, filters neutral) or a filter (no people). */
export function conditionsToSave(
  filters: SegmentFilters,
  selected: ReadonlySet<string>,
): SegmentConditions {
  const base: SegmentConditions = {
    language: filters.language,
    newsletter: filters.newsletter,
    services: filters.services,
    lastBooking: filters.lastBooking,
    neverBooked: filters.neverBooked,
    hasBooked: filters.hasBooked ?? false,
  };
  return normalizeSegmentConditions(
    selected.size > 0
      ? { ...base, manualIds: [...selected].sort(), manualOnly: true }
      : base,
  );
}

type Editable = {
  name: string;
  filters: SegmentFilters;
  selected: ReadonlySet<string>;
};

const keyOf = (state: Editable) =>
  JSON.stringify([
    state.name.trim(),
    state.filters.language,
    state.filters.newsletter,
    [...state.filters.services].sort(),
    state.filters.lastBooking,
    state.filters.neverBooked,
    state.filters.hasBooked ?? false,
    [...state.selected].sort(),
  ]);

/** Whether anything the person can change differs from where she started. */
export function isDirty(start: Editable, now: Editable): boolean {
  return keyOf(start) !== keyOf(now);
}
