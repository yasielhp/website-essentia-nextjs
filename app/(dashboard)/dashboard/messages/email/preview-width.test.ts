import { describe, expect, test } from "bun:test";
import { previewWidth } from "./preview-width";

describe("previewWidth", () => {
  test("mobile is a phone's width, and desktop is all the room", () => {
    expect(previewWidth("mobile").width).toBe(375);
    expect(previewWidth("desktop").width).toBe("100%");
  });
  test("neither is ever wider than what holds it", () => {
    expect(previewWidth("mobile").maxWidth).toBe("100%");
    expect(previewWidth("desktop").maxWidth).toBe("100%");
  });
});
