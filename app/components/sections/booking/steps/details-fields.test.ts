import { describe, expect, test } from "bun:test";
import { DETAILS_FIELD_ID, firstInvalidFieldId } from "./details-fields";

describe("firstInvalidFieldId", () => {
  test("no errors, nothing to focus", () => {
    expect(firstInvalidFieldId({})).toBeNull();
    expect(firstInvalidFieldId({ phone: undefined, consent: "" })).toBeNull();
  });

  test("it is the first field in error as the form shows them, not as the errors were found", () => {
    expect(
      firstInvalidFieldId({
        consent: "consentRequired",
        phone: "phoneInvalid",
        lastName: "lastNameRequired",
      }),
    ).toBe(DETAILS_FIELD_ID.lastName);
    expect(
      firstInvalidFieldId({
        consent: "consentRequired",
        email: "emailInvalid",
      }),
    ).toBe(DETAILS_FIELD_ID.email);
  });

  test("the terms box alone sends the focus to the box", () => {
    expect(firstInvalidFieldId({ consent: "consentRequired" })).toBe(
      DETAILS_FIELD_ID.consent,
    );
  });

  test("a field with no control of its own on the list is skipped", () => {
    expect(firstInvalidFieldId({ notes: "tooLong" })).toBeNull();
  });
});
