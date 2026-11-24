import { describe, expect, test } from "bun:test";
import { isSlotTaken, NO_OVERLAP_CONSTRAINT, SLOT_TAKEN } from "./slot-taken";

/**
 * The one reading of the database's refusal of a taken hour, which every
 * writer maps to `slot_taken`: by the code Postgres gives an exclusion
 * violation, or by the constraint's name in the message.
 */
describe("isSlotTaken", () => {
  test("the code of an exclusion violation is enough", () => {
    expect(isSlotTaken({ code: "23P01", message: "anything" })).toBe(true);
  });

  test("so is the constraint's name, as PostgREST words it", () => {
    expect(
      isSlotTaken({
        message:
          'conflicting key value violates exclusion constraint "bookings_no_overlap"',
      }),
    ).toBe(true);
  });

  test("any other refusal is not a taken hour", () => {
    for (const error of [
      { code: "23505", message: "duplicate key value" },
      { code: "42501", message: "permission denied for table bookings" },
      { message: "boom" },
      new Error("network"),
      "23P01",
      null,
      undefined,
    ]) {
      expect(isSlotTaken(error)).toBe(false);
    }
  });

  test("the names the code and the migration share", () => {
    expect(SLOT_TAKEN).toBe("slot_taken");
    expect(NO_OVERLAP_CONSTRAINT).toBe("bookings_no_overlap");
  });
});
