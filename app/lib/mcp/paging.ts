import { z } from "zod";

/** The limit and offset every list tool takes, with the same bounds. */
export const pagingShape = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe("Rows to return (1-50)."),
  offset: z
    .number()
    .int()
    .min(0)
    .max(100000)
    .default(0)
    .describe("Rows to skip."),
};

/** The `[from, to]` pair PostgREST's `range` wants. */
export function rangeOf(limit: number, offset: number): [number, number] {
  return [offset, offset + limit - 1];
}

/** A `YYYY-MM-DD` day. */
export const dayShape = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * Text going into a PostgREST filter, made safe to put there. Its grammar uses
 * commas, parentheses and `*`; a term carrying them would be read as syntax
 * instead of searched for.
 */
export function searchTerm(q: string): string {
  return q
    .replace(/[,()*%_\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}
