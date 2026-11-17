import { describe, expect, it } from "bun:test";
import { DRAFT_HOLD_MS, asDraftId, holdsSlot, isOwnDraft } from "./holds-slot";

const now = new Date("2026-12-01T12:00:00Z");
const minutesAgo = (m: number) =>
  new Date(now.getTime() - m * 60 * 1000).toISOString();

describe("holdsSlot", () => {
  it("a confirmed or pending booking holds its hour whatever its age", () => {
    expect(
      holdsSlot({ status: "confirmed", created_at: minutesAgo(10_000) }, now),
    ).toBe(true);
    expect(
      holdsSlot({ status: "pending", created_at: minutesAgo(10_000) }, now),
    ).toBe(true);
  });

  it("a cancelled booking never does", () => {
    expect(
      holdsSlot({ status: "cancelled", created_at: minutesAgo(1) }, now),
    ).toBe(false);
  });

  it("a fresh draft holds its hour while the form is being filled in", () => {
    expect(holdsSlot({ status: "draft", created_at: minutesAgo(5) }, now)).toBe(
      true,
    );
    expect(
      holdsSlot(
        {
          status: "draft",
          created_at: new Date(now.getTime() - DRAFT_HOLD_MS).toISOString(),
        },
        now,
      ),
    ).toBe(true);
  });

  it("an abandoned draft lets go after an hour", () => {
    expect(
      holdsSlot({ status: "draft", created_at: minutesAgo(61) }, now),
    ).toBe(false);
  });

  it("a draft with no usable creation time does not hold anything", () => {
    expect(holdsSlot({ status: "draft", created_at: null }, now)).toBe(false);
    expect(holdsSlot({ status: "draft", created_at: "not a date" }, now)).toBe(
      false,
    );
  });
});

describe("isOwnDraft: the hour a visitor's own draft holds is hers", () => {
  const ID = "3f2b8c1e-5d47-4a9b-8e21-0c9d7a6b5e4f";
  const OTHER = "9a1c7e2d-0b34-4f6a-9c85-1e2f3a4b5c6d";

  it("her own draft does not take her hour away from her", () => {
    expect(isOwnDraft({ id: ID, status: "draft" }, ID)).toBe(true);
  });

  it("somebody else's draft still does", () => {
    expect(isOwnDraft({ id: OTHER, status: "draft" }, ID)).toBe(false);
  });

  it("an id that names a real booking frees nothing, whoever sends it", () => {
    for (const status of ["pending", "confirmed", "completed", null]) {
      expect(isOwnDraft({ id: ID, status }, ID)).toBe(false);
    }
  });

  it("no id, no exclusion", () => {
    expect(isOwnDraft({ id: ID, status: "draft" }, null)).toBe(false);
    expect(isOwnDraft({ id: null, status: "draft" }, null)).toBe(false);
  });
});

describe("asDraftId", () => {
  it("takes a uuid, in either case", () => {
    expect(asDraftId("3F2B8C1E-5D47-4A9B-8E21-0C9D7A6B5E4F")).toBe(
      "3f2b8c1e-5d47-4a9b-8e21-0c9d7a6b5e4f",
    );
  });

  it("anything else is no id at all", () => {
    for (const value of [
      null,
      undefined,
      "",
      "b-1",
      42,
      {},
      "3f2b8c1e-5d47-4a9b-8e21-0c9d7a6b5e4f,other",
      "* ",
    ]) {
      expect(asDraftId(value)).toBeNull();
    }
  });
});
