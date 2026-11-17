import { describe, expect, it } from "bun:test";
import { MESSAGE_CATALOG, MESSAGE_KEYS } from "./catalog";
import { VARIABLE_PARAM_FIELD, allowedParamFields } from "./param-fields";

describe("VARIABLE_PARAM_FIELD", () => {
  it("maps each variable to the field of the same name, and only those", () => {
    for (const [variable, field] of Object.entries(VARIABLE_PARAM_FIELD)) {
      expect(field).toBe(variable as never);
    }
    expect(Object.keys(VARIABLE_PARAM_FIELD).sort()).toEqual([
      "date",
      "first_name",
      "service",
      "session_type",
      "time",
    ]);
  });

  it("leaves out the variables a sender could not read", () => {
    for (const variable of [
      "duration",
      "amount_due",
      "amount_paid",
      "sessions",
      "expires_on",
      "cancel_url",
      "consent_url",
    ] as const) {
      expect(VARIABLE_PARAM_FIELD[variable]).toBeUndefined();
    }
  });
});

describe("allowedParamFields", () => {
  it("is what the message offers and a field exists for", () => {
    expect(allowedParamFields("booking_confirmed")).toEqual([
      "first_name",
      "service",
      "session_type",
      "date",
      "time",
    ]);
    // booking_paid has no session type to offer.
    expect(allowedParamFields("booking_paid")).toEqual([
      "first_name",
      "service",
      "date",
      "time",
    ]);
    expect(allowedParamFields("consent_request")).toEqual(["first_name"]);
  });

  it("never allows a field the message does not offer", () => {
    for (const key of MESSAGE_KEYS) {
      const offered = new Set<string>(MESSAGE_CATALOG[key].variables);
      for (const field of allowedParamFields(key)) {
        expect(offered.has(field)).toBe(true);
      }
    }
  });

  it("never allows the fields that belong to blog posts", () => {
    for (const key of MESSAGE_KEYS) {
      const fields: string[] = allowedParamFields(key);
      expect(fields).not.toContain("post_title");
      expect(fields).not.toContain("post_url");
      expect(fields).not.toContain("last_name");
    }
  });
});
