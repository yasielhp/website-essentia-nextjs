import { describe, expect, test } from "bun:test";
import { MAX_PAGES, PAGE_SIZE, readAllPages } from "./paged-read";

/** A table of `n` rows that, like the real one, never gives more than a page. */
function table(n: number) {
  const calls: [number, number][] = [];
  const page = async (from: number, to: number) => {
    calls.push([from, to]);
    const end = Math.min(to + 1, n, from + PAGE_SIZE);
    return {
      data: Array.from({ length: Math.max(0, end - from) }, (_, i) => ({
        id: from + i,
      })),
      error: null,
    };
  };
  return { page, calls };
}

describe("readAllPages", () => {
  test("2500 rows are three pages and all of them, in order", async () => {
    const { page, calls } = table(2_500);
    const rows = await readAllPages("contacts", page);
    expect(rows).toHaveLength(2_500);
    expect(rows.map((r) => r.id)).toEqual(
      Array.from({ length: 2_500 }, (_, i) => i),
    );
    expect(calls).toEqual([
      [0, 999],
      [1_000, 1_999],
      [2_000, 2_999],
    ]);
  });
  test("a table that fits in one page is one read", async () => {
    const { page, calls } = table(40);
    expect(await readAllPages("contacts", page)).toHaveLength(40);
    expect(calls).toHaveLength(1);
  });
  test("an empty table is empty, not an error", async () => {
    expect(await readAllPages("contacts", table(0).page)).toEqual([]);
  });
  test("a table of exactly a page asks once more and finds it ends", async () => {
    const { page, calls } = table(PAGE_SIZE);
    expect(await readAllPages("contacts", page)).toHaveLength(PAGE_SIZE);
    expect(calls).toHaveLength(2);
  });
  test("a page that fails fails the whole read: never a partial list", async () => {
    let n = 0;
    const page = async (from: number, to: number) => {
      n++;
      if (n === 2) return { data: null, error: { message: "timeout" } };
      return table(5_000).page(from, to);
    };
    await expect(readAllPages("bookings", page)).rejects.toThrow(
      "bookings read failed: timeout",
    );
  });
  test("a table past the safety cap is an explicit error, not a silent cut", async () => {
    const { page } = table(MAX_PAGES * PAGE_SIZE + 500);
    await expect(readAllPages("contacts", page)).rejects.toThrow(
      "longer than the audience can read",
    );
  });
  test("the cap itself, with every page full, is also refused: there may be more", async () => {
    const { page } = table(MAX_PAGES * PAGE_SIZE);
    await expect(readAllPages("contacts", page)).rejects.toThrow("stopped at");
  });
});
