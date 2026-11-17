import { describe, expect, test } from "bun:test";
import { isSwitchedOff, rowHasText, switchInput } from "./reminder-switch";

const row = (over = {}) => ({
  enabled: true,
  doc: null,
  subject: null,
  preheader: null,
  title: null,
  ...over,
});

describe("switchInput", () => {
  test("carries the switch and nothing else: the text is not touched", () => {
    expect(switchInput("booking_reminder", "es", false)).toEqual({
      key: "booking_reminder",
      channel: "email",
      locale: "es",
      enabled: false,
    });
    expect(
      Object.keys(switchInput("booking_reminder", "es", true)).sort(),
    ).toEqual(["channel", "enabled", "key", "locale"]);
  });
});

describe("rowHasText", () => {
  test("a row with only the switch has no text of its own", () => {
    expect(rowHasText(row())).toBe(false);
    expect(rowHasText(row({ enabled: false }))).toBe(false);
    expect(rowHasText(undefined)).toBe(false);
    expect(rowHasText(null)).toBe(false);
  });
  test("any of the four texts makes it the admin's", () => {
    expect(rowHasText(row({ subject: "Hola" }))).toBe(true);
    expect(rowHasText(row({ preheader: "x" }))).toBe(true);
    expect(rowHasText(row({ title: "x" }))).toBe(true);
    expect(rowHasText(row({ doc: { type: "doc", content: [] } }))).toBe(true);
  });
  test("spaces are not text", () => {
    expect(rowHasText(row({ subject: "   ", title: " " }))).toBe(false);
  });
});

describe("isSwitchedOff", () => {
  test("only a message that can be switched off, with a row that says so", () => {
    expect(isSwitchedOff(true, row({ enabled: false }))).toBe(true);
    expect(isSwitchedOff(true, row({ enabled: true }))).toBe(false);
    expect(isSwitchedOff(true, undefined)).toBe(false);
    expect(isSwitchedOff(false, row({ enabled: false }))).toBe(false);
  });
});
