import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import {
  argsOf,
  chainDb,
  filters,
  has,
  type Step,
} from "@/lib/campaigns/fake-db";

/**
 * "Restore the default" through the real action, with the role check and the
 * database replaced by one row held in memory that honours the filters of each
 * query. What matters: a reminder the admin switched off is never switched
 * back on by a reset, not even when the switch is turned between the read and
 * the write.
 */

type Row = { enabled: boolean; subject: string | null; doc: unknown };

let row: Row | null = null;
/** Runs once, right after the action has read the row: the other admin. */
let afterRead: (() => void) | null = null;
let queries: Step[][] = [];

const real = {
  admin: { ...(await import("@/lib/insforge-admin")) },
  guard: { ...(await import("@/lib/auth-guard")) },
  cache: { ...(await import("next/cache")) },
};
let reset: typeof import("./message-templates").resetMessageTemplate;

const matches = (chain: Step[]) => {
  const wanted = filters(chain);
  return (
    row !== null && (!("enabled" in wanted) || wanted.enabled === row.enabled)
  );
};

beforeAll(async () => {
  mock.module("next/cache", () => ({
    ...real.cache,
    revalidatePath: () => {},
  }));
  mock.module("@/lib/auth-guard", () => ({
    ...real.guard,
    requireRole: async () => ({
      userId: "admin-1",
      email: "a@example.test",
      role: "admin",
    }),
  }));
  mock.module("@/lib/insforge-admin", () => ({
    getAdminClient: () => {
      const made = chainDb(async (table, chain) => {
        if (table !== "message_templates") return { data: null, error: null };
        queries.push([...chain]);
        if (has(chain, "delete")) {
          if (!matches(chain)) return { data: [], error: null };
          row = null;
          return { data: [{ key: "x" }], error: null };
        }
        if (has(chain, "update")) {
          if (!matches(chain)) return { data: [], error: null };
          row = { ...row!, ...(argsOf(chain, "update")![0] as Partial<Row>) };
          return { data: [{ enabled: row.enabled }], error: null };
        }
        const data = row ? { enabled: row.enabled } : null;
        afterRead?.();
        afterRead = null;
        return { data, error: null };
      });
      return { database: { from: (table: string) => made.db.from(table) } };
    },
  }));
  ({ resetMessageTemplate: reset } = await import("./message-templates"));
});

afterAll(() => {
  mock.module("next/cache", () => real.cache);
  mock.module("@/lib/auth-guard", () => real.guard);
  mock.module("@/lib/insforge-admin", () => real.admin);
});

beforeEach(() => {
  row = null;
  afterRead = null;
  queries = [];
});

const edited = (enabled: boolean): Row => ({
  enabled,
  subject: "Mi asunto",
  doc: { type: "doc", content: [] },
});

describe("resetting the reminder's email", () => {
  const run = () => reset("token", "booking_reminder", "email", "es");

  test("nothing saved: nothing to do", async () => {
    expect(await run()).toEqual({ ok: true, removed: false, kept: null });
  });

  test("switched on: the row is deleted", async () => {
    row = edited(true);
    expect(await run()).toEqual({ ok: true, removed: true, kept: null });
    expect(row).toBeNull();
  });

  test("switched off: the row stays, emptied, still off", async () => {
    row = edited(false);
    expect(await run()).toEqual({ ok: true, removed: false, kept: "disabled" });
    expect(row).toMatchObject({ enabled: false, subject: null, doc: null });
  });

  test("switched off between the read and the delete: it is not deleted, and stays off", async () => {
    row = edited(true);
    afterRead = () => {
      row = { ...row!, enabled: false };
    };
    const out = await run();
    // Deleting it would have turned the reminder back on without a word.
    expect(row).not.toBeNull();
    expect(row!.enabled).toBe(false);
    expect(row!.subject).toBeNull();
    expect(row!.doc).toBeNull();
    expect(out).toEqual({ ok: true, removed: false, kept: "disabled" });
  });

  test("the delete only ever takes a row that is on", async () => {
    row = edited(true);
    await run();
    const del = queries.find((chain) => has(chain, "delete"))!;
    expect(filters(del)).toEqual({
      key: "booking_reminder",
      channel: "email",
      locale: "es",
      enabled: true,
    });
  });

  test("the emptying never touches the switch", async () => {
    row = edited(false);
    await run();
    const update = queries.find((chain) => has(chain, "update"))!;
    expect(argsOf(update, "update")![0]).not.toHaveProperty("enabled");
  });

  test("switched back on between the read and the emptying: emptied and on, which is the default email", async () => {
    row = edited(false);
    afterRead = () => {
      row = { ...row!, enabled: true };
    };
    const out = await run();
    expect(row).toMatchObject({ enabled: true, subject: null, doc: null });
    expect(out).toEqual({ ok: true, removed: false, kept: null });
  });

  test("deleted by somebody else in between: a success with nothing removed", async () => {
    row = edited(true);
    afterRead = () => {
      row = null;
    };
    expect(await run()).toEqual({ ok: true, removed: false, kept: null });
  });
});

describe("resetting any message, email or WhatsApp: the switch is kept", () => {
  for (const channel of ["email", "whatsapp"] as const) {
    test(`${channel}: a row that is on is deleted, and only while it is still on`, async () => {
      row = edited(true);
      queries = [];
      const out = await reset("token", "booking_confirmed", channel, "es");
      expect(out).toEqual({ ok: true, removed: true, kept: null });
      expect(row).toBeNull();
      const del = queries.find((chain) => has(chain, "delete"))!;
      expect(filters(del)).toMatchObject({ enabled: true });
    });

    test(`${channel}: a row that is off is emptied and stays off: deleting it would switch the message on without a word`, async () => {
      row = edited(false);
      const out = await reset("token", "booking_confirmed", channel, "es");
      expect(out).toEqual({ ok: true, removed: false, kept: "disabled" });
      expect(row).not.toBeNull();
      expect(row!.enabled).toBe(false);
      expect(row!.subject).toBeNull();
    });
  }
});
