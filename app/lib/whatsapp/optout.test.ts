import { describe, expect, test } from "bun:test";
import { isOptOutText, matchOptOut } from "@/lib/whatsapp/optout";

describe("isOptOutText", () => {
  test("accepts the two opt-out words", () => {
    expect(isOptOutText("STOP")).toBe(true);
    expect(isOptOutText("BAJA")).toBe(true);
  });
  test("ignores case, surrounding spaces and trailing punctuation", () => {
    expect(isOptOutText("Stop.")).toBe(true);
    expect(isOptOutText(" baja! ")).toBe(true);
    expect(isOptOutText("stop!!!")).toBe(true);
    expect(isOptOutText("¡Baja!")).toBe(true);
  });
  test("ignores accents", () => {
    expect(isOptOutText("BÁJA")).toBe(true);
    expect(isOptOutText("stóp")).toBe(true);
  });
  test("does not treat CANCELAR as an opt-out: it usually means a booking", () => {
    expect(isOptOutText("CANCELAR")).toBe(false);
    expect(isOptOutText("cancelar")).toBe(false);
  });
  test("a sentence that merely contains the word is not an opt-out", () => {
    expect(isOptOutText("no quiero parar")).toBe(false);
    expect(isOptOutText("dar de baja")).toBe(false);
    expect(isOptOutText("stop please")).toBe(false);
  });
  test("empty or missing text is not an opt-out", () => {
    expect(isOptOutText("")).toBe(false);
    expect(isOptOutText("   ")).toBe(false);
    expect(isOptOutText(undefined)).toBe(false);
    expect(isOptOutText(null)).toBe(false);
  });
});

describe("matchOptOut", () => {
  const contacts = [
    { id: "a", phone: "600 11 22 33" },
    { id: "b", phone: "600-112-233" },
    { id: "c", phone: "+34 600 11 22 33" },
    { id: "d", phone: "0034600112233" },
    { id: "e", phone: "34600112233" },
    { id: "f", phone: "611 99 88 77" },
    { id: "g", phone: null },
    { id: "h", phone: "abc" },
    { id: "i", phone: "" },
  ];

  test("every way of writing the same number matches", () => {
    expect(matchOptOut("34600112233", contacts).sort()).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
    ]);
  });
  test("a different number matches only itself", () => {
    expect(matchOptOut("34611998877", contacts)).toEqual(["f"]);
  });
  test("a number nobody has matches nothing", () => {
    expect(matchOptOut("34699000000", contacts)).toEqual([]);
  });
  test("null or garbage phones never match", () => {
    expect(matchOptOut("34600112233", contacts)).not.toContain("g");
    expect(matchOptOut("34600112233", contacts)).not.toContain("h");
    expect(matchOptOut("34600112233", contacts)).not.toContain("i");
  });
  test("a sender that is not a usable number matches nothing", () => {
    expect(matchOptOut("", contacts)).toEqual([]);
    expect(matchOptOut("abc", contacts)).toEqual([]);
  });
  test("accepts a sender that already carries a plus sign", () => {
    expect(matchOptOut("+34600112233", contacts)).toHaveLength(5);
  });
});
