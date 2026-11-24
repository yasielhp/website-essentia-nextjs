import { describe, expect, test } from "bun:test";
import { shownPreview } from "./preview-state";

describe("the preview of the email", () => {
  test("shows what was drawn for the language on screen", () => {
    expect(shownPreview({ locale: "es", html: "<p>Hola</p>" }, "es")).toBe(
      "<p>Hola</p>",
    );
  });

  test("right after a switch it shows nothing (loading), never the other language's email", () => {
    expect(
      shownPreview({ locale: "es", html: "<p>Hola</p>" }, "en"),
    ).toBeNull();
  });

  test("nothing drawn yet is nothing shown", () => {
    expect(shownPreview(null, "es")).toBeNull();
  });
});
