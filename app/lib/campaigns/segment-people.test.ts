import { describe, expect, test } from "bun:test";
import { EMPTY_AUDIENCE, type SegmentPerson } from "@/types/campaign";
import { segmentConditionsSchema } from "@/lib/schemas";
import { MAX_LIST_PEOPLE } from "./segment-conditions";
import {
  activeFilters,
  applyFilterPatch,
  conditionsToSave,
  headerCheckState,
  isDirty,
  listIsFull,
  personName,
  removeFilter,
  searchMatches,
  segmentSentence,
  toSegmentPerson,
  toggleOne,
  toggleVisible,
  visiblePeople,
} from "./segment-people";

const NOW = new Date("2026-11-17T12:00:00Z");

let seq = 0;
const person = (over: Partial<SegmentPerson> = {}): SegmentPerson => {
  seq += 1;
  return {
    id: `id-${seq}`,
    firstName: `Ana${seq}`,
    lastName: `Pérez${seq}`,
    email: `ana${seq}@example.com`,
    phone: `+3460011${1000 + seq}`,
    language: "es",
    newsletter: false,
    serviceIds: [],
    bookingsCount: 0,
    lastBookingDate: null,
    emailIssue: null,
    whatsappIssue: null,
    ...over,
  };
};
const ids = (list: { id: string }[]) => list.map((p) => p.id);
const filters = (over = {}) => ({ ...EMPTY_AUDIENCE, ...over });

describe("toSegmentPerson", () => {
  const candidate = {
    id: "c1",
    email: "a@b.c",
    firstName: "Ana",
    lastName: "Pérez",
    phone: "600112233",
    language: "es",
    newsletter: true,
    bouncedAt: null,
    unsubscribedAt: null,
    lastBookingDate: "2026-10-01",
    serviceIds: ["yoga"],
    bookingsCount: 2,
  };
  test("carries what the filters read, and no reason when nothing blocks her", () => {
    expect(toSegmentPerson(candidate)).toMatchObject({
      id: "c1",
      email: "a@b.c",
      newsletter: true,
      serviceIds: ["yoga"],
      bookingsCount: 2,
      emailIssue: null,
      whatsappIssue: null,
    });
  });
  test("names why an email would not reach her: unsubscribed, or bounced", () => {
    expect(
      toSegmentPerson({ ...candidate, unsubscribedAt: "2026-10-01" })
        .emailIssue,
    ).toBe("unsubscribed");
    expect(
      toSegmentPerson({ ...candidate, bouncedAt: "2026-10-01" }).emailIssue,
    ).toBe("bounced");
    // An unsubscribe is the person's word and says more than a bounce.
    expect(
      toSegmentPerson({ ...candidate, unsubscribedAt: "x", bouncedAt: "y" })
        .emailIssue,
    ).toBe("unsubscribed");
  });
  test("and why a WhatsApp would not: she said STOP, or the number has no WhatsApp", () => {
    expect(
      toSegmentPerson({ ...candidate, whatsappOptedOutAt: "2026-10-01" })
        .whatsappIssue,
    ).toBe("stopped");
    expect(
      toSegmentPerson({ ...candidate, whatsappUnreachableAt: "2026-10-01" })
        .whatsappIssue,
    ).toBe("unreachable");
  });
  test("a person with no email still has none, not a made-up one", () => {
    expect(toSegmentPerson({ ...candidate, email: "" }).email).toBe("");
  });
});

describe("visiblePeople", () => {
  const es = person({ language: "es", newsletter: true });
  const en = person({ language: "en", newsletter: false });
  const people = [es, en];

  test("no filters, no search: everybody", () => {
    expect(
      ids(
        visiblePeople({
          people,
          filters: filters(),
          search: "",
          now: NOW,
        }),
      ),
    ).toEqual(ids(people));
  });
  test("the filters narrow what is shown, by the engine's own rule", () => {
    const out = visiblePeople({
      people,
      filters: filters({ language: "es" }),
      search: "",
      now: NOW,
    });
    expect(ids(out)).toEqual([es.id]);
    expect(
      ids(
        visiblePeople({
          people,
          filters: filters({ newsletter: true }),
          search: "",
          now: NOW,
        }),
      ),
    ).toEqual([es.id]);
  });
  test("the search finds by name, email or phone, ignoring case, accents and spacing", () => {
    const ana = person({
      firstName: "José",
      lastName: "Núñez",
      email: "JOSE@Example.com",
      phone: "+34 600 11 22 33",
    });
    const all = [ana, es];
    const find = (search: string) =>
      ids(
        visiblePeople({
          people: all,
          filters: filters(),
          search,
          now: NOW,
        }),
      );
    expect(find("jose")).toEqual([ana.id]);
    expect(find("NUNEZ")).toEqual([ana.id]);
    expect(find("example.com")).toContain(ana.id);
    expect(find("600 11 22")).toEqual([ana.id]);
    expect(find("60011223")).toEqual([ana.id]);
    expect(find("   ")).toEqual(ids(all));
    expect(find("nadie")).toEqual([]);
  });
});

describe("the selection survives filtering and searching", () => {
  test("toggleOne adds and removes, and leaves the rest alone", () => {
    const a = new Set(["a"]);
    expect([...toggleOne(a, "b")].sort()).toEqual(["a", "b"]);
    expect([...toggleOne(a, "a")]).toEqual([]);
    expect([...a]).toEqual(["a"]);
  });
  test("selecting what is seen adds it to what was already selected out of sight", () => {
    const out = toggleVisible(new Set(["hidden"]), ["v1", "v2"]);
    expect([...out].sort()).toEqual(["hidden", "v1", "v2"]);
  });
  test("when every visible one is selected, the same click un-selects them, and only them", () => {
    const out = toggleVisible(new Set(["hidden", "v1", "v2"]), ["v1", "v2"]);
    expect([...out]).toEqual(["hidden"]);
  });
  test("with some selected, the click selects the rest", () => {
    const out = toggleVisible(new Set(["v1"]), ["v1", "v2"]);
    expect([...out].sort()).toEqual(["v1", "v2"]);
  });
  test("nothing visible changes nothing", () => {
    const s = new Set(["a"]);
    expect([...toggleVisible(s, [])]).toEqual(["a"]);
  });
  test("the header checkbox is none, some or all of what is seen", () => {
    expect(headerCheckState(new Set(), ["a", "b"])).toBe("none");
    expect(headerCheckState(new Set(["a"]), ["a", "b"])).toBe("some");
    expect(headerCheckState(new Set(["a", "b", "x"]), ["a", "b"])).toBe("all");
    expect(headerCheckState(new Set(["a"]), [])).toBe("none");
  });
});

describe("the filters on show", () => {
  test("none by default", () => {
    expect(activeFilters(filters())).toEqual([]);
  });
  test("one chip per filter that is on, in the order the dialog has them", () => {
    const on = activeFilters(
      filters({
        language: "es",
        newsletter: true,
        hasBooked: true,
        services: ["yoga", "masaje"],
        lastBooking: { op: "gt", days: 60 },
      }),
    );
    expect(on).toEqual([
      { id: "language", value: "es" },
      { id: "subscription" },
      { id: "bookings", value: "booked" },
      { id: "services", value: ["yoga", "masaje"] },
      { id: "lastBooking", value: { op: "gt", days: 60 } },
    ]);
  });
  test("never booked is a filter of its own, and the booking ones fall away with it", () => {
    const on = activeFilters(filters({ neverBooked: true }));
    expect(on).toEqual([{ id: "bookings", value: "never" }]);
  });
  test("removing a chip clears that filter and no other", () => {
    const base = filters({
      language: "es",
      newsletter: true,
      services: ["yoga"],
    });
    expect(removeFilter(base, "language")).toMatchObject({
      language: "any",
      newsletter: true,
      services: ["yoga"],
    });
    expect(removeFilter(base, "subscription")).toMatchObject({
      newsletter: null,
      language: "es",
    });
    expect(removeFilter(base, "services").services).toEqual([]);
    expect(
      removeFilter(filters({ neverBooked: true }), "bookings"),
    ).toMatchObject({ neverBooked: false, hasBooked: false });
    expect(
      removeFilter(
        filters({ lastBooking: { op: "lt", days: 3 } }),
        "lastBooking",
      ).lastBooking,
    ).toBeNull();
  });
  test("never booked cannot hold alongside a booking condition: setting it clears them", () => {
    const out = applyFilterPatch(
      filters({
        services: ["yoga"],
        lastBooking: { op: "gt", days: 5 },
        hasBooked: true,
      }),
      { neverBooked: true },
    );
    expect(out).toMatchObject({
      neverBooked: true,
      services: [],
      lastBooking: null,
      hasBooked: false,
    });
  });
});

describe("the sentence under the table", () => {
  test("with nobody picked it is a filter: the people who meet it, and who will later", () => {
    expect(segmentSentence(0, 7)).toEqual({ key: "filter", count: 7 });
  });
  test("with people picked it is a list: only them", () => {
    expect(segmentSentence(3, 7)).toEqual({ key: "list", count: 3 });
  });
});

describe("what is saved", () => {
  const sel = new Set(["b", "a"]);
  test("nobody picked: the filters, as a filter", () => {
    const out = conditionsToSave(filters({ language: "es" }), new Set());
    expect(out).toMatchObject({ language: "es" });
    expect("manualIds" in out).toBe(false);
    expect("manualOnly" in out).toBe(false);
  });
  test("people picked: a list, the filters left at their neutral value", () => {
    const out = conditionsToSave(
      filters({ language: "es", newsletter: true }),
      sel,
    );
    expect(out).toMatchObject({
      language: "any",
      newsletter: null,
      manualOnly: true,
    });
    expect(out.manualIds).toEqual(["a", "b"]);
  });
});

describe("isDirty", () => {
  const start = { name: "A", filters: filters(), selected: new Set(["a"]) };
  test("the same name, filters and people is not a change", () => {
    expect(isDirty(start, { ...start, selected: new Set(["a"]) })).toBe(false);
  });
  test("a name, a filter or a person is", () => {
    expect(isDirty(start, { ...start, name: "B" })).toBe(true);
    expect(
      isDirty(start, { ...start, filters: filters({ language: "es" }) }),
    ).toBe(true);
    expect(isDirty(start, { ...start, selected: new Set(["a", "b"]) })).toBe(
      true,
    );
  });
  test("a name's spaces are not a change; the order of people is not either", () => {
    expect(
      isDirty(
        { ...start, selected: new Set(["a", "b"]) },
        { ...start, name: " A ", selected: new Set(["b", "a"]) },
      ),
    ).toBe(false);
  });
});

describe("names", () => {
  test("first and last, or a dash", () => {
    expect(personName(person({ firstName: "Ana", lastName: "Pérez" }))).toBe(
      "Ana Pérez",
    );
    expect(personName(person({ firstName: "Ana", lastName: null }))).toBe(
      "Ana",
    );
    expect(personName(person({ firstName: "", lastName: null }))).toBe("—");
  });
  test("searchMatches reads name, email and phone", () => {
    const p = person({
      firstName: "Ana",
      lastName: "Pérez",
      email: "a@b.c",
      phone: "+34600112233",
    });
    expect(searchMatches(p, "perez")).toBe(true);
    expect(searchMatches(p, "a@b")).toBe(true);
    expect(searchMatches(p, "600112")).toBe(true);
    expect(searchMatches(p, "zzz")).toBe(false);
  });
});

describe("a list holds two thousand people, and no more", () => {
  const many = (n: number, prefix = "p") =>
    Array.from({ length: n }, (_, i) => `${prefix}${i}`);

  test("the limit is the schema's, one number", () => {
    expect(MAX_LIST_PEOPLE).toBe(2000);
    const base = {
      language: "any",
      newsletter: null,
      services: [],
      lastBooking: null,
      neverBooked: false,
    };
    const uuid = (i: number) =>
      `6f1c2a3e-1111-4222-8333-${String(i).padStart(12, "0")}`;
    const ids = (n: number) => Array.from({ length: n }, (_, i) => uuid(i));
    expect(
      segmentConditionsSchema.safeParse({
        ...base,
        manualIds: ids(MAX_LIST_PEOPLE),
        manualOnly: true,
      }).success,
    ).toBe(true);
    expect(
      segmentConditionsSchema.safeParse({
        ...base,
        manualIds: ids(MAX_LIST_PEOPLE + 1),
        manualOnly: true,
      }).success,
    ).toBe(false);
  });
  test("a pick past the limit is not made; taking one off still works at the limit", () => {
    const full = new Set(many(MAX_LIST_PEOPLE));
    expect(listIsFull(full)).toBe(true);
    expect(toggleOne(full, "extra").size).toBe(MAX_LIST_PEOPLE);
    expect(toggleOne(full, "extra").has("extra")).toBe(false);
    expect(toggleOne(full, "p0").size).toBe(MAX_LIST_PEOPLE - 1);
    expect(listIsFull(new Set(many(MAX_LIST_PEOPLE - 1)))).toBe(false);
  });
  test("selecting what is seen fills only the room there is", () => {
    const nearly = new Set(many(MAX_LIST_PEOPLE - 3));
    const out = toggleVisible(nearly, ["a", "b", "c", "d", "e"]);
    expect(out.size).toBe(MAX_LIST_PEOPLE);
    expect(["a", "b", "c"].every((id) => out.has(id))).toBe(true);
    expect(out.has("e")).toBe(false);
  });
  test("a selection under the limit is untouched by it", () => {
    expect(toggleVisible(new Set(), ["a", "b"]).size).toBe(2);
  });
});
