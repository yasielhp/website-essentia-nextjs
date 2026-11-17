import { describe, expect, test } from "bun:test";
import { EMPTY_AUDIENCE } from "@/types/campaign";
import { segmentConditionsSchema, segmentSchema } from "@/lib/schemas";
import {
  countPicked,
  normalizeSegmentConditions,
  segmentKindOf,
} from "./segment-conditions";

const A = "6f1c2a3e-1111-4222-8333-444455556661";
const B = "6f1c2a3e-1111-4222-8333-444455556662";

const base = {
  language: "any",
  newsletter: null,
  services: [],
  lastBooking: null,
  neverBooked: false,
};

describe("segmentKindOf", () => {
  test("a segment saved before lists existed is a filter", () => {
    expect(segmentKindOf({ ...base } as never)).toBe("filter");
    expect(segmentKindOf({ ...base, manualIds: [] } as never)).toBe("filter");
  });
  test("one with people picked and manualOnly is a list", () => {
    expect(
      segmentKindOf({ ...base, manualIds: [A], manualOnly: true } as never),
    ).toBe("list");
  });
  test("manualOnly with nobody is not a list: it would reach nobody, so it reads as a filter", () => {
    expect(
      segmentKindOf({ ...base, manualIds: [], manualOnly: true } as never),
    ).toBe("filter");
  });
  test("people without manualOnly are not a list either", () => {
    expect(segmentKindOf({ ...base, manualIds: [A] } as never)).toBe("filter");
  });
});

describe("normalizeSegmentConditions", () => {
  test("a filter keeps its conditions and drops any list", () => {
    const out = normalizeSegmentConditions({
      ...base,
      language: "es",
      services: ["yoga"],
      manualIds: [A],
    } as never);
    expect(out).toMatchObject({ language: "es", services: ["yoga"] });
    expect("manualIds" in out).toBe(false);
    expect("manualOnly" in out).toBe(false);
  });
  test("a list is stored with the other conditions at their neutral value", () => {
    const out = normalizeSegmentConditions({
      ...base,
      language: "es",
      newsletter: true,
      services: ["yoga"],
      lastBooking: { op: "gt", days: 30 },
      neverBooked: true,
      hasBooked: true,
      manualIds: [A, B, A],
      manualOnly: true,
    } as never);
    expect(out).toEqual({
      language: "any",
      newsletter: null,
      services: [],
      lastBooking: null,
      neverBooked: false,
      hasBooked: false,
      manualIds: [A, B],
      manualOnly: true,
    });
  });
});

describe("the segment's schema", () => {
  const ok = (conditions: unknown) =>
    segmentSchema.safeParse({ name: "x", conditions }).success;

  test("an old segment, with no list, is valid exactly as before", () => {
    expect(ok({ ...base })).toBe(true);
    expect(ok({ ...base, language: "es", hasBooked: true })).toBe(true);
  });
  test("a list: uuids, no repeats, at least one", () => {
    expect(ok({ ...base, manualIds: [A, B], manualOnly: true })).toBe(true);
    expect(ok({ ...base, manualIds: [], manualOnly: true })).toBe(false);
    expect(ok({ ...base, manualOnly: true })).toBe(false);
    expect(ok({ ...base, manualIds: [A, A], manualOnly: true })).toBe(false);
    expect(ok({ ...base, manualIds: ["not-a-uuid"], manualOnly: true })).toBe(
      false,
    );
  });
  test("people without manualOnly are refused: it would be neither kind", () => {
    expect(ok({ ...base, manualIds: [A] })).toBe(false);
  });
  test("manualOnly can only be true", () => {
    expect(ok({ ...base, manualIds: [A], manualOnly: false })).toBe(false);
  });
  test("two thousand is the most a list holds", () => {
    const many = (n: number) =>
      Array.from(
        { length: n },
        (_, i) => `6f1c2a3e-1111-4222-8333-${String(i).padStart(12, "0")}`,
      );
    expect(ok({ ...base, manualIds: many(2000), manualOnly: true })).toBe(true);
    expect(ok({ ...base, manualIds: many(2001), manualOnly: true })).toBe(
      false,
    );
  });
  test("it parses to what the save stores", () => {
    const parsed = segmentConditionsSchema.parse({
      ...base,
      manualIds: [A],
      manualOnly: true,
    });
    expect(parsed.manualOnly).toBe(true);
    expect(parsed.manualIds).toEqual([A]);
    expect(EMPTY_AUDIENCE.manualIds).toEqual([]);
  });
});

describe("countPicked: the people of a list that are still there", () => {
  test("a contact deleted since is not counted, as the page of the list does not show her", () => {
    expect(countPicked([A, B], new Set([A]))).toBe(1);
    expect(countPicked([A, B], new Set([A, B, "other"]))).toBe(2);
    expect(countPicked([A, B], new Set())).toBe(0);
  });
  test("no ids is zero", () => {
    expect(countPicked(undefined, new Set([A]))).toBe(0);
    expect(countPicked([], new Set([A]))).toBe(0);
  });
});
