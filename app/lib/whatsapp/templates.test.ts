import { describe, expect, test } from "bun:test";
import {
  countParams,
  paramIssues,
  renderPreview,
} from "@/lib/whatsapp/templates";

describe("countParams", () => {
  test("counts the highest placeholder", () => {
    expect(countParams("Hola {{1}}, tu cita es el {{2}} a las {{3}}.")).toBe(3);
  });
  test("zero when there are none", () => {
    expect(countParams("Sin parámetros")).toBe(0);
  });
  test("an empty body has none", () => {
    expect(countParams("")).toBe(0);
  });
  test("a repeated index counts once", () => {
    expect(countParams("{{1}} y {{1}}")).toBe(1);
  });
  test("is the highest index, not how many there are", () => {
    expect(countParams("a {{3}} b")).toBe(3);
  });
  test("ignores malformed placeholders", () => {
    expect(countParams("a {{0}} {{01}} {{ 1 }} {{abc}} b")).toBe(0);
  });
  test("ignores anything above 50, so the int column never overflows", () => {
    expect(countParams("a {{51}} b")).toBe(0);
    expect(countParams("a {{99999999999999999999}} b")).toBe(0);
    expect(countParams("a {{50}} b")).toBe(50);
  });
});

describe("paramIssues", () => {
  test("placeholders must run 1..n with no gaps", () => {
    expect(paramIssues("Hola {{1}} y {{3}}, hasta pronto.")).toEqual([
      "paramGap",
    ]);
  });
  test("a body that starts or ends with a placeholder is refused by Meta", () => {
    expect(paramIssues("{{1}} te espera")).toEqual(["paramAtEdge"]);
    expect(paramIssues("Te espera {{1}}")).toEqual(["paramAtEdge"]);
  });
  test("whitespace around the edge does not hide the placeholder", () => {
    expect(paramIssues("  {{1}} hola")).toEqual(["paramAtEdge"]);
    expect(paramIssues("hola {{1}}\n\n")).toEqual(["paramAtEdge"]);
  });
  test("a placeholder followed by punctuation is not at the edge", () => {
    expect(paramIssues("hola {{1}}.")).toEqual([]);
  });
  test("clean body has no issues", () => {
    expect(paramIssues("Hola {{1}}, hasta pronto.")).toEqual([]);
  });
  test("a gap and an edge are both reported", () => {
    expect(paramIssues("Hola {{1}} y {{3}}")).toEqual([
      "paramGap",
      "paramAtEdge",
    ]);
  });
  test("an empty body has no issues", () => {
    expect(paramIssues("")).toEqual([]);
  });
  test("a repeated index is not a gap", () => {
    expect(paramIssues("Hola {{1}} y otra vez {{1}}, adiós.")).toEqual([]);
  });
  test("anything that is not exactly {{n}} with n in 1..50 is malformed", () => {
    for (const bad of [
      "{{0}}",
      "{{01}}",
      "{{ 1 }}",
      "{{abc}}",
      "{{}}",
      "{{51}}",
      "{{-1}}",
      "{{1.5}}",
      "{{99999999999999999999}}",
    ]) {
      expect(paramIssues(`Hola ${bad}, adiós.`)).toEqual(["paramMalformed"]);
    }
  });
  test("a malformed placeholder does not also raise a gap", () => {
    expect(paramIssues("Hola {{1}} y {{0}}, adiós.")).toEqual([
      "paramMalformed",
    ]);
  });
  test("both bounds are valid", () => {
    expect(paramIssues("a {{1}} b")).toEqual([]);
    expect(paramIssues("a {{50}} b")).not.toContain("paramMalformed");
  });
});

describe("renderPreview", () => {
  test("fills placeholders in order and leaves missing ones visible", () => {
    expect(renderPreview("Hola {{1}}, {{2}}.", ["Ana"])).toBe(
      "Hola Ana, {{2}}.",
    );
  });
  test("treats $ in a value literally", () => {
    expect(renderPreview("a {{1}} b", ["$&"])).toBe("a $& b");
    expect(renderPreview("a {{1}} b", ["$1"])).toBe("a $1 b");
    expect(renderPreview("a {{1}} b", ["$$"])).toBe("a $$ b");
  });
  test("fills the same index every time it appears", () => {
    expect(renderPreview("{{1}} y {{1}}", ["Ana"])).toBe("Ana y Ana");
  });
  test("an empty value keeps the placeholder, a blank one is filled", () => {
    expect(renderPreview("a {{1}} b", [""])).toBe("a {{1}} b");
    expect(renderPreview("a {{1}} b", ["  "])).toBe("a    b");
  });
  test("a value that looks like a placeholder is not expanded again", () => {
    expect(renderPreview("a {{1}} b {{2}}", ["{{2}}", "Luis"])).toBe(
      "a {{2}} b Luis",
    );
  });
  test("leaves malformed placeholders alone", () => {
    expect(renderPreview("a {{0}} {{ 1 }} {{abc}} b", ["x"])).toBe(
      "a {{0}} {{ 1 }} {{abc}} b",
    );
  });
});
