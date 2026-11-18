import { describe, expect, test } from "bun:test";
import {
  isSwitchedOff,
  rowHasText,
  summarizeSwitch,
  switchTarget,
} from "./reminder-switch";

const row = (over = {}) => ({
  enabled: true,
  doc: null,
  subject: null,
  preheader: null,
  title: null,
  ...over,
});

describe("summarizeSwitch", () => {
  test("on when no language is off, off when all are, partial between", () => {
    expect(summarizeSwitch(["es", "en"], [])).toEqual({
      state: "on",
      offLocales: [],
    });
    expect(summarizeSwitch(["es", "en"], ["es", "en"])).toEqual({
      state: "off",
      offLocales: ["es", "en"],
    });
    expect(summarizeSwitch(["es", "en"], ["en"])).toEqual({
      state: "partial",
      offLocales: ["en"],
    });
    expect(summarizeSwitch(["es"], ["es"]).state).toBe("off");
  });
  test("a language the message is not sent in does not count", () => {
    expect(summarizeSwitch(["es"], ["en"])).toEqual({
      state: "on",
      offLocales: [],
    });
  });
});

describe("switchTarget: what a click does", () => {
  test("on turns off; off turns on; partial turns on, which equalises the languages", () => {
    expect(switchTarget(summarizeSwitch(["es", "en"], []))).toBe(false);
    expect(switchTarget(summarizeSwitch(["es", "en"], ["es", "en"]))).toBe(
      true,
    );
    expect(switchTarget(summarizeSwitch(["es", "en"], ["en"]))).toBe(true);
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
  test("only a row that says false is off; no row, a null or an odd value is on", () => {
    expect(isSwitchedOff(row({ enabled: false }))).toBe(true);
    expect(isSwitchedOff(row({ enabled: true }))).toBe(false);
    expect(isSwitchedOff({ enabled: null })).toBe(false);
    expect(isSwitchedOff(undefined)).toBe(false);
    expect(isSwitchedOff(null)).toBe(false);
  });
});
