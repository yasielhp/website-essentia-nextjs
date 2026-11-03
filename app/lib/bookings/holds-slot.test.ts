import { describe, expect, it } from "bun:test";
import { DRAFT_HOLD_MS, holdsSlot } from "./holds-slot";

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
