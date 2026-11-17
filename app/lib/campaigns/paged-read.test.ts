import { describe, expect, test } from "bun:test";
import { MAX_REQUESTS, MAX_ROWS, PAGE_SIZE, readAllPages } from "./paged-read";

/**
 * A table of `n` rows that, like the real one, never gives more than `limit`
 * rows in a request whatever range was asked for.
 */
function table(n: number, limit = 1_000) {
  const calls: [number, number][] = [];
  const page = async (from: number, to: number) => {
    calls.push([from, to]);
    const end = Math.min(to + 1, n, from + limit);
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
  test("2500 rows come whole, in order, whatever the server's limit", async () => {
    for (const limit of [1_000, 500, 300]) {
      const { page } = table(2_500, limit);
      const rows = await readAllPages("contacts", page);
      expect(rows).toHaveLength(2_500);
      expect(rows.map((r) => r.id)).toEqual(
        Array.from({ length: 2_500 }, (_, i) => i),
      );
    }
  });
  test("each page starts where the rows received ended", async () => {
    const { page, calls } = table(2_500, 500);
    await readAllPages("contacts", page);
    expect(calls.map(([from]) => from)).toEqual([
      0, 500, 1_000, 1_500, 2_000, 2_500,
    ]);
    expect(calls[0]).toEqual([0, PAGE_SIZE - 1]);
  });
  test("a short page is not the end: only an empty one is", async () => {
    const { page, calls } = table(40);
    expect(await readAllPages("contacts", page)).toHaveLength(40);
    expect(calls).toHaveLength(2);
  });
  test("an empty table is empty, not an error", async () => {
    expect(await readAllPages("contacts", table(0).page)).toEqual([]);
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
    const { page } = table(MAX_ROWS + 500);
    await expect(readAllPages("contacts", page)).rejects.toThrow(
      "longer than it can read",
    );
  });
  test("a table of exactly the cap is read whole", async () => {
    const { page } = table(MAX_ROWS);
    expect(await readAllPages("contacts", page)).toHaveLength(MAX_ROWS);
  });
  test("a server that answers one row at a time is refused, not looped on forever", async () => {
    const { page } = table(MAX_REQUESTS * 3, 1);
    await expect(readAllPages("contacts", page)).rejects.toThrow("requests");
  });
  test("a null page is an empty one", async () => {
    expect(
      await readAllPages("contacts", async () => ({ data: null, error: null })),
    ).toEqual([]);
  });
});
