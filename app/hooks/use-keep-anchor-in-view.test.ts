import { describe, expect, test } from "bun:test";
import { anchorDrifted } from "./use-keep-anchor-in-view";

describe("anchorDrifted", () => {
  test("an element where the anchor put it (at its scroll margin) has not drifted", () => {
    expect(anchorDrifted(80, 80)).toBe(false);
    expect(anchorDrifted(90, 80)).toBe(false);
  });
  test("one pushed down by what loaded above it has", () => {
    expect(anchorDrifted(400, 80)).toBe(true);
    expect(anchorDrifted(-200, 80)).toBe(true);
  });
  test("the tolerance is a few pixels, not a pixel: no fight with a scroll that is nearly there", () => {
    expect(anchorDrifted(100, 80, 24)).toBe(false);
    expect(anchorDrifted(105, 80, 24)).toBe(true);
  });
});
