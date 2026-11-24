/**
 * An in-memory stand-in for the tables a booking is written against, for
 * tests only: nothing in the app imports this file.
 *
 * It reads the query chains the code builds (through `chainDb`) and answers
 * them from a few arrays, the way PostgREST would: `eq`, `neq`, `in`, `is` and
 * `ilike` filters, `insert`, `update` with or without `select`, `maybeSingle`
 * and `single`. And it keeps the rule of `bookings_no_overlap` (migration
 * `20261124_bookings_no_overlap.sql`): a row that holds a slot (any status but
 * `draft` and `cancelled`, with a professional, a day from 2026-11-24 on and
 * an hour) cannot overlap another of the same professional; the write is
 * refused with the database's `23P01`, as the real one is.
 *
 * Of the functions of the database it knows one, `promote_contact_to_client`,
 * as its SQL is: a contact with no status or a `lead` becomes a `client`, any
 * other is left alone. Every call is kept in `rpcs`; any other function is
 * answered with an error, as PostgREST answers one it does not have.
 */

import { chainDb, type Query, type Step } from "@/lib/campaigns/fake-db";
import { parseDurationMinutes } from "@/utils/format";

export type Row = Record<string, unknown>;

/** The id the n-th row written gets: a uuid, as the database's would be. */
export const fakeId = (n: number): string =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export type FakeTables = {
  bookings: Row[];
  service_tiers: Row[];
  staff_tiers: Row[];
  contacts: Row[];
  service_settings: Row[];
  /** Only for the tests that read who is of the team. */
  profiles?: Row[];
  /** Only for the tests that read a booking's history. */
  booking_events?: Row[];
};

export type Failure = { table: string; kind: "select" | "insert" | "update" };

export const OVERLAP_ERROR = {
  code: "23P01",
  message:
    'conflicting key value violates exclusion constraint "bookings_no_overlap"',
};

const kindOf = (chain: Step[]): "select" | "insert" | "update" | "delete" =>
  chain.some((s) => s.name === "insert")
    ? "insert"
    : chain.some((s) => s.name === "update")
      ? "update"
      : chain.some((s) => s.name === "delete")
        ? "delete"
        : "select";

/** An ILIKE pattern with no wildcard, as `likeLiteral` writes an address. */
const unescapeLike = (pattern: string) => pattern.replace(/\\(.)/g, "$1");

/** The filters of the chain, as PostgREST reads them: eq, neq, in, is, ilike. */
const filtersOf = (chain: Step[]): ((row: Row) => boolean)[] =>
  chain.flatMap((step): ((row: Row) => boolean)[] => {
    const [column, value] = step.args as [string, unknown];
    switch (step.name) {
      case "eq":
        return [(row) => row[column] === value];
      case "neq":
        return [(row) => row[column] !== value];
      case "in":
        return [(row) => (value as unknown[]).includes(row[column])];
      case "is":
        return [(row) => (row[column] ?? null) === value];
      case "ilike":
        return [
          (row) =>
            String(row[column] ?? "").toLowerCase() ===
            unescapeLike(String(value)).toLowerCase(),
        ];
      default:
        return [];
    }
  });

const matches = (row: Row, filters: ((row: Row) => boolean)[]) =>
  filters.every((keep) => keep(row));

/** The day the constraint starts judging: history before it is not. */
export const NO_OVERLAP_FROM = "2026-11-24";

const holdsSlot = (row: Row) =>
  row.status !== "draft" &&
  row.status !== "cancelled" &&
  typeof row.staff_id === "string" &&
  typeof row.date === "string" &&
  row.date >= NO_OVERLAP_FROM &&
  typeof row.time === "string" &&
  /^\d{1,2}:\d{2}$/.test(row.time);

function range(row: Row): [number, number] {
  const [h, m] = String(row.time).split(":").map(Number);
  const day = Date.parse(`${String(row.date)}T00:00:00Z`) / 60_000;
  const start = day + (h ?? 0) * 60 + (m ?? 0);
  return [start, start + parseDurationMinutes(row.duration as string | null)];
}

/** The first `fakeId` no row of the table has: ids last as the tables do. */
function freshId(rows: Row[]): string {
  let n = 1;
  while (rows.some((row) => row.id === fakeId(n))) n += 1;
  return fakeId(n);
}

/** Whether `row` would clash, under the constraint, with any of `others`. */
export function clashes(row: Row, others: Row[]): boolean {
  if (!holdsSlot(row)) return false;
  const [start, end] = range(row);
  return others.some((other) => {
    if (other.id === row.id || !holdsSlot(other)) return false;
    if (other.staff_id !== row.staff_id) return false;
    const [s, e] = range(other);
    return start < e && s < end;
  });
}

export function fakeBookingsDb(
  tables: FakeTables,
  options: {
    /** Whether this query fails with a database error (the test decides). */
    fail?: (query: Failure) => boolean;
    /** Runs just before an UPDATE of `bookings` lands. */
    beforeUpdate?: () => void;
  } = {},
): {
  db: ReturnType<typeof chainDb>["db"];
  log: Query[];
  rpcs: { name: string; args: Row }[];
} {
  const rpcs: { name: string; args: Row }[] = [];
  const built = chainDb((table, chain) => {
    const kind = kindOf(chain);
    if (kind !== "delete" && options.fail?.({ table, kind })) {
      return { data: null, error: { message: "boom" } };
    }
    const rows = (tables as Record<string, Row[]>)[table] ?? [];
    const filters = filtersOf(chain);
    const wantsOne = chain.some(
      (s) => s.name === "maybeSingle" || s.name === "single",
    );
    const selects = chain.some((s) => s.name === "select");

    if (kind === "insert") {
      const incoming = (chain.find((s) => s.name === "insert")!.args[0] ??
        []) as Row[];
      const written: Row[] = [];
      for (const raw of incoming) {
        const row = {
          id: raw.id ?? freshId([...rows, ...written]),
          // Each table's own default: a booking is `pending`, a contact a `lead`.
          status: table === "contacts" ? "lead" : "pending",
          ...raw,
        };
        if (table === "bookings" && clashes(row, [...rows, ...written])) {
          return { data: null, error: OVERLAP_ERROR };
        }
        written.push(row);
      }
      rows.push(...written);
      const ids = written.map((r) => ({ id: r.id }));
      return { data: wantsOne ? (ids[0] ?? null) : ids, error: null };
    }

    if (kind === "update") {
      const patch = chain.find((s) => s.name === "update")!.args[0] as Row;
      if (table === "bookings") options.beforeUpdate?.();
      const hit = rows.filter((r) => matches(r, filters));
      const after = hit.map((r) => ({ ...r, ...patch }));
      if (table === "bookings") {
        const rest = rows.filter((r) => !hit.includes(r));
        for (const row of after) {
          if (clashes(row, [...rest, ...after.filter((o) => o !== row)])) {
            return { data: null, error: OVERLAP_ERROR };
          }
        }
      }
      hit.forEach((r, i) => Object.assign(r, after[i]));
      return {
        data: selects ? hit.map((r) => ({ id: r.id })) : null,
        error: null,
      };
    }

    const found = rows.filter((r) => matches(r, filters));
    return {
      data: wantsOne ? (found[0] ? { ...found[0] } : null) : found,
      error: null,
    };
  });
  const rpc = async (name: string, args: Row) => {
    rpcs.push({ name, args });
    if (name !== "promote_contact_to_client") {
      return { data: null, error: { message: `no function ${name}` } };
    }
    for (const row of tables.contacts) {
      if (row.id !== args.p_contact_id) continue;
      if (row.status == null || row.status === "lead") row.status = "client";
    }
    return { data: null, error: null };
  };
  Object.assign(built.db, { rpc });
  return { ...built, rpcs };
}
