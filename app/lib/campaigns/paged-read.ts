/**
 * Reads a table to its end, a page at a time.
 *
 * The database answers a request with at most so many rows whatever range was
 * asked for (a thousand today), so a single `range(0, 9999)` quietly returned
 * the first thousand and an audience, a count or a send built on it was short
 * without anyone being told. This asks page after page.
 *
 * It does not depend on what that limit is: each request asks for a page of
 * `PAGE_SIZE`, the next starts where the rows ACTUALLY RECEIVED ended, and the
 * read ends only when a page comes back empty. If the server's limit were 500
 * or 300, a short page would still not be taken for the end.
 *
 * It never returns part of a table: a page that fails fails the whole read, and
 * a table longer than the safety cap is an explicit error, not a silent cut.
 * The query it is given MUST have a total order (a unique column last), or rows
 * could repeat or be skipped from one page to the next.
 */
export const PAGE_SIZE = 1_000;
/** Far past this centre's contacts: a bound on how much one read may hold. */
export const MAX_ROWS = 10_000;
/** A bound on the requests of one read, whatever size the server answers. */
export const MAX_REQUESTS = 200;

type Page<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

export async function readAllPages<T>(
  what: string,
  page: (from: number, to: number) => PromiseLike<Page<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let request = 0; request < MAX_REQUESTS; request++) {
    const from = rows.length;
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${what} read failed: ${error.message}`);
    const got = data ?? [];
    // An empty page is the only end: the table has no more after these rows.
    if (got.length === 0) return rows;
    rows.push(...got);
    if (rows.length > MAX_ROWS) {
      throw new Error(
        `${what} read stopped past ${MAX_ROWS} rows: the table is longer than it can read`,
      );
    }
  }
  throw new Error(
    `${what} read stopped after ${MAX_REQUESTS} requests: the server answers in pieces too small to read the table`,
  );
}
