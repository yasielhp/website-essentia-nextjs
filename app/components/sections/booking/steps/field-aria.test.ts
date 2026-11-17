import { describe, expect, test } from "bun:test";
import { fieldAria, fieldErrorId } from "./field-aria";

describe("fieldAria", () => {
  test("a required field says so to a screen reader, and nothing else", () => {
    expect(fieldAria({ id: "phone", required: true })).toEqual({
      "aria-required": true,
    });
  });

  test("a field in error is invalid and points at its own message", () => {
    expect(
      fieldAria({ id: "phone", required: true, error: "phoneInvalid" }),
    ).toEqual({
      "aria-required": true,
      "aria-invalid": true,
      "aria-describedby": "phone-error",
    });
    expect(fieldErrorId("phone")).toBe("phone-error");
  });

  test("an optional field with no error carries no attribute at all", () => {
    expect(fieldAria({ id: "notes" })).toEqual({});
    expect(fieldAria({ id: "notes", required: false, error: "" })).toEqual({});
  });
});
