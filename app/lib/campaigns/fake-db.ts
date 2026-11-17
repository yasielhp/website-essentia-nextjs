/**
 * A stand-in for the Insforge client that records every query chain and lets
 * a test answer it. For tests only: nothing in the app imports this file.
 *
 * Any method name is accepted and appended to the chain; awaiting the chain
 * (the SDK's builders are thenables) logs it and resolves to whatever
 * `respond` returns for that table and chain.
 */

import type { getAdminClient } from "@/lib/insforge-admin";

export type FakeDbClient = ReturnType<typeof getAdminClient>["database"];

export type Step = { name: string; args: unknown[] };
export type Query = { table: string; chain: Step[] };
export type Respond = (
  table: string,
  chain: Step[],
) => unknown | Promise<unknown>;

export function chainDb(respond: Respond): {
  db: FakeDbClient;
  log: Query[];
} {
  const log: Query[] = [];
  const db = {
    from(table: string) {
      const chain: Step[] = [];
      const builder: unknown = new Proxy(function () {}, {
        get(_target, prop) {
          if (prop === "then") {
            return (
              resolve: (value: unknown) => void,
              reject: (reason: unknown) => void,
            ) => {
              log.push({ table, chain: [...chain] });
              Promise.resolve()
                .then(() => respond(table, chain))
                .then(resolve, reject);
            };
          }
          return (...args: unknown[]) => {
            chain.push({ name: String(prop), args });
            return builder;
          };
        },
      });
      return builder;
    },
  };
  return { db: db as unknown as FakeDbClient, log };
}

export const has = (chain: Step[], name: string): boolean =>
  chain.some((step) => step.name === name);

/** The arguments of the first step with this name, or undefined. */
export const argsOf = (chain: Step[], name: string): unknown[] | undefined =>
  chain.find((step) => step.name === name)?.args;

/** Every `.eq(column, value)` of the chain, as a plain object. */
export const filters = (chain: Step[]): Record<string, unknown> =>
  Object.fromEntries(
    chain
      .filter((step) => step.name === "eq")
      .map((step) => [String(step.args[0]), step.args[1]]),
  );

/** `table.step(args).step(args)`, for assertions that read like the code. */
export const show = ({ table, chain }: Query): string =>
  `${table}.${chain.map((s) => `${s.name}(${s.args.map((a) => JSON.stringify(a)).join(",")})`).join(".")}`;
