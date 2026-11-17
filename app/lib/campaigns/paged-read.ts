/**
 * Reads a table to its end, a page at a time.
 *
 * The database answers a request with at most a thousand rows whatever range
 * was asked for, so a single `range(0, 9999)` quietly returned the first
 * thousand and an audience, a count or a send built on it was short without
 * anyone being told. This asks page after page until one comes back short.
 *
 * It never returns part of a table: a page that fails fails the whole read, and
 * a table longer than the safety cap is an explicit error, not a silent cut.
 * The query it is given MUST have a total order (a unique column last), or rows
 * could repeat or be skipped from one page to the next.
 */
export const PAGE_SIZE = 1_000;
/** 10 000 rows: far past this centre's contacts, and a bound on a runaway loop. */
export const MAX_PAGES = 10;

type Page<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

export async function readAllPages<T>(
  what: string,
  page: (from: number, to: number) => PromiseLike<Page<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let n = 0; n < MAX_PAGES; n++) {
    const from = n * PAGE_SIZE;
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${what} read failed: ${error.message}`);
    const got = data ?? [];
    rows.push(...got);
    if (got.length < PAGE_SIZE) return rows;
  }
  // Every page was full and the cap is reached: there may be more.
  throw new Error(
    `${what} read stopped at ${MAX_PAGES * PAGE_SIZE} rows: the table is longer than the audience can read`,
  );
}
