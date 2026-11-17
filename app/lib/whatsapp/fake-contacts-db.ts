/**
 * A tiny in-memory stand-in for the service-key client: just the chain these
 * functions use (`select`/`update`, `eq`, `is`, `limit`, `select` after an
 * update, `rpc`), applied to real rows so a filter that is missing really lets
 * a row through. `beforeWrite` runs between the read and the write, which is
 * where a STOP can land.
 */
export type Row = Record<string, string | boolean | null>;

export function fakeDb(
  rows: Row[],
  opts: { failOn?: "read" | "write"; beforeWrite?: (rows: Row[]) => void } = {},
) {
  const calls = { rpc: [] as { name: string; args: unknown }[] };
  const db = {
    from() {
      const filters: ((r: Row) => boolean)[] = [];
      let patch: Row | null = null;
      const chain = {
        select() {
          if (patch) {
            // `.select()` after `.update()`: run the write now.
            if (opts.failOn === "write") {
              return Promise.resolve({
                data: null,
                error: { message: "boom" },
              });
            }
            opts.beforeWrite?.(rows);
            const hit = rows.filter((r) => filters.every((f) => f(r)));
            for (const r of hit) Object.assign(r, patch);
            return Promise.resolve({
              data: hit.map((r) => ({ ...r })),
              error: null,
            });
          }
          return chain;
        },
        update(p: Row) {
          patch = p;
          return chain;
        },
        eq(col: string, value: unknown) {
          filters.push((r) => r[col] === value);
          return chain;
        },
        is(col: string, value: null) {
          filters.push((r) => (r[col] ?? null) === value);
          return chain;
        },
        limit() {
          if (opts.failOn === "read") {
            return Promise.resolve({ data: null, error: { message: "boom" } });
          }
          return Promise.resolve({
            data: rows.filter((r) => filters.every((f) => f(r))),
            error: null,
          });
        },
      };
      return chain;
    },
    rpc(name: string, args: unknown) {
      calls.rpc.push({ name, args });
      return Promise.resolve({ data: "contact-id", error: null });
    },
  };
  return { db: db as never, calls };
}
