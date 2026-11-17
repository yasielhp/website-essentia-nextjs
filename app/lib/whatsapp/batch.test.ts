import { describe, expect, test } from "bun:test";
import { inBatches } from "@/lib/whatsapp/batch";

describe("inBatches", () => {
  test("splits into runs of the given size, the last one shorter", () => {
    expect(inBatches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  test("an exact multiple leaves no empty run", () => {
    expect(inBatches([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });
  test("fewer items than the size is one run", () => {
    expect(inBatches([1, 2], 10)).toEqual([[1, 2]]);
  });
  test("nothing in, nothing out", () => {
    expect(inBatches([], 10)).toEqual([]);
  });
  test("keeps the order", () => {
    const items = Array.from({ length: 45 }, (_, i) => i);
    const runs = inBatches(items, 10);
    expect(runs.map((run) => run.length)).toEqual([10, 10, 10, 10, 5]);
    expect(runs.flat()).toEqual(items);
  });
  test("a size below one is treated as one, never an endless loop", () => {
    expect(inBatches([1, 2], 0)).toEqual([[1], [2]]);
    expect(inBatches([1, 2], -3)).toEqual([[1], [2]]);
    expect(inBatches([1, 2, 3], 1.9)).toEqual([[1], [2], [3]]);
  });
});
