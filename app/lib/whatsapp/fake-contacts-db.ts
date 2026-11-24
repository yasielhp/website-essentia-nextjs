/**
 * A tiny in-memory stand-in for the service-key client: just the chain these
 * functions use (`select`/`update`/`insert`, `eq`, `is`, `limit`,
 * `maybeSingle`, `single`, `select` after an update or an insert, an update
 * awaited on its own, `rpc`), applied to real rows so a filter that is missing
 * really lets a row through. `beforeWrite` runs between the read and the
 * write, which is where a STOP can land. An insert of an address that is
 * already there is refused as the unique index refuses it (`23505`).
 */
export type Row = Record<string, string | boolean | null>;

export function fakeDb(
  rows: Row[],
  opts: { failOn?: "read" | "write"; beforeWrite?: (rows: Row[]) => void } = {},
) {
  const calls = {
    rpc: [] as { name: string; args: unknown }[],
    inserts: [] as Row[],
    updates: [] as Row[],
  };
  const db = {
    from() {
      const filters: ((r: Row) => boolean)[] = [];
      let patch: Row | null = null;
      let incoming: Row[] | null = null;
      const write = () => {
        if (opts.failOn === "write") {
          return { data: null, error: { message: "boom" } };
        }
        opts.beforeWrite?.(rows);
        const hit = rows.filter((r) => filters.every((f) => f(r)));
        for (const r of hit) Object.assign(r, patch);
        calls.updates.push({ ...patch! });
        return { data: hit.map((r) => ({ ...r })), error: null };
      };
      const insert = () => {
        if (opts.failOn === "write") {
          return { data: null, error: { message: "boom" } };
        }
        const row = incoming![0]!;
        if (rows.some((r) => r.email === row.email)) {
          return {
            data: null,
            error: { code: "23505", message: "duplicate key" },
          };
        }
        const id = `c${rows.length + 1}`;
        rows.push({ id, ...row });
        calls.inserts.push({ ...row });
        return { data: { id }, error: null };
      };
      const read = () => {
        if (opts.failOn === "read") {
          return { data: null, error: { message: "boom" } };
        }
        return {
          data: rows.filter((r) => filters.every((f) => f(r))),
          error: null,
        };
      };
      const chain = {
        insert(r: Row[]) {
          incoming = r;
          return chain;
        },
        single() {
          return Promise.resolve(incoming ? insert() : read());
        },
        maybeSingle() {
          const answer = read();
          return Promise.resolve(
            answer.error
              ? answer
              : {
                  data: answer.data![0] ? { ...answer.data![0] } : null,
                  error: null,
                },
          );
        },
        // An update awaited with no `.select()` after it.
        then(
          resolve: (value: unknown) => void,
          reject: (reason: unknown) => void,
        ) {
          try {
            resolve(patch ? write() : read());
          } catch (err) {
            reject(err);
          }
        },
        select() {
          if (incoming) return chain;
          if (patch) {
            // `.select()` after `.update()`: run the write now.
            return Promise.resolve(write());
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
          return Promise.resolve(read());
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
