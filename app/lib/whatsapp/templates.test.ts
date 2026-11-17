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
  test("clean body has no issues", () => {
    expect(paramIssues("Hola {{1}}, hasta pronto.")).toEqual([]);
  });
});

describe("renderPreview", () => {
  test("fills placeholders in order and leaves missing ones visible", () => {
    expect(renderPreview("Hola {{1}}, {{2}}.", ["Ana"])).toBe(
      "Hola Ana, {{2}}.",
    );
  });
});
