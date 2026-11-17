import { describe, expect, test } from "bun:test";
import { radioTarget } from "./radio-nav";

describe("radioTarget", () => {
  test("right and down go to the next, wrapping at the end", () => {
    expect(radioTarget("ArrowRight", 0, 2)).toBe(1);
    expect(radioTarget("ArrowDown", 0, 2)).toBe(1);
    expect(radioTarget("ArrowRight", 1, 2)).toBe(0);
  });
  test("left and up go to the previous, wrapping at the start", () => {
    expect(radioTarget("ArrowLeft", 1, 2)).toBe(0);
    expect(radioTarget("ArrowUp", 0, 2)).toBe(1);
  });
  test("home and end jump to the ends", () => {
    expect(radioTarget("Home", 2, 3)).toBe(0);
    expect(radioTarget("End", 0, 3)).toBe(2);
  });
  test("any other key is not ours", () => {
    expect(radioTarget("Tab", 0, 2)).toBeNull();
    expect(radioTarget("Enter", 0, 2)).toBeNull();
    expect(radioTarget(" ", 0, 2)).toBeNull();
  });
  test("a group with nothing in it has nowhere to go", () => {
    expect(radioTarget("ArrowRight", 0, 0)).toBeNull();
  });
});
