import { describe, expect, test } from "bun:test";
import { MESSAGE_CATALOG, MESSAGE_KEYS } from "./catalog";
import {
  VARIABLE_KINDS,
  variableKind,
  type VariableKind,
} from "./variable-kinds";

const everyVariable = [
  ...new Set(MESSAGE_KEYS.flatMap((key) => MESSAGE_CATALOG[key].variables)),
];
describe("the kind of each variable", () => {
  test("every variable any message offers has a kind", () => {
    for (const name of everyVariable) {
      expect(variableKind(name)).not.toBeNull();
    }
  });

  test("the kinds are the ones the brief names", () => {
    expect(variableKind("first_name")).toBe("person");
    expect(variableKind("service")).toBe("service");
    expect(variableKind("session_type")).toBe("session");
    expect(variableKind("date")).toBe("date");
    expect(variableKind("expires_on")).toBe("date");
    expect(variableKind("time")).toBe("time");
    expect(variableKind("duration")).toBe("duration");
    expect(variableKind("amount_due")).toBe("money");
    expect(variableKind("amount_paid")).toBe("money");
    expect(variableKind("cancel_url")).toBe("link");
    expect(variableKind("consent_url")).toBe("link");
  });

  test("a name the catalogue does not offer has no kind", () => {
    expect(variableKind("nope")).toBeNull();
    expect(variableKind("constructor")).toBeNull();
  });

  test("the list of kinds is the one set every one of them belongs to", () => {
    const kinds = new Set<VariableKind>(
      everyVariable.map((v) => variableKind(v)!),
    );
    for (const kind of kinds) expect(VARIABLE_KINDS).toContain(kind);
  });
});
