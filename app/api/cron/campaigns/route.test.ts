import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import { NextRequest } from "next/server";
import { argsOf, chainDb, filters, has } from "@/lib/campaigns/fake-db";

/**
 * The real campaigns cron, with the database, the dispatch and the automation
 * run replaced: what a tick does with what it reads, and what it leaves
 * written on a campaign.
 */

type Stored = Record<string, unknown> & { id: string; status: string };
type Answer = { data: unknown; error: { message: string } | null };

const HOUR = 3_600_000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

/** The campaigns as the database holds them when an UPDATE arrives. */
let stored = new Map<string, Stored>();
/** What each of the tick's three reads answers. */
let reads: Record<"scheduled" | "stuck" | "active", () => Answer>;
let dispatched: { id: string; resume: boolean }[] = [];

const none = (): Answer => ({ data: [], error: null });

const { db, log } = chainDb((table, chain) => {
  if (table !== "campaigns") return none();
  const eq = filters(chain);
  const update = argsOf(chain, "update");
  if (!update) {
    if (eq.status === "scheduled") return reads.scheduled();
    if (eq.status === "sending") return reads.stuck();
    if (eq.status === "active") return reads.active();
    return none();
  }
  const row = stored.get(String(eq.id));
  const matches =
    row !== undefined &&
    Object.entries(eq).every(([column, value]) => row[column] === value) &&
    chain
      .filter((step) => step.name === "lt")
      .every(({ args: [column, value] }) => {
        const current = row[String(column)];
        return typeof current === "string" && current < String(value);
      });
  const wantsRows = has(chain, "select");
  if (!row || !matches) return { data: wantsRows ? [] : null, error: null };
  Object.assign(row, update[0]);
  return { data: wantsRows ? [{ id: row.id }] : null, error: null };
});

const real = {
  admin: { ...(await import("@/lib/insforge-admin")) },
  dispatch: { ...(await import("@/lib/campaigns/dispatch")) },
  automations: { ...(await import("@/lib/campaigns/automations")) },
};

let GET: (r: NextRequest) => Promise<Response>;

beforeAll(async () => {
  process.env.CRON_SECRET = "s3cret";
  mock.module("@/lib/insforge-admin", () => ({
    ...real.admin,
    getAdminClient: () => ({ database: db }),
  }));
  mock.module("@/lib/campaigns/dispatch", () => ({
    ...real.dispatch,
    reconcileAllInterrupted: async () => [],
    dispatchCampaign: async (id: string, opts: { resume?: boolean } = {}) => {
      dispatched.push({ id, resume: opts.resume === true });
      return { ok: true, sent: 0, failed: 0 };
    },
  }));
  mock.module("@/lib/campaigns/automations", () => ({
    ...real.automations,
    runAutomation: async () => ({ queued: 0, sent: 0, failed: 0 }),
  }));
  ({ GET } = await import("./route"));
});

afterAll(() => {
  mock.module("@/lib/insforge-admin", () => real.admin);
  mock.module("@/lib/campaigns/dispatch", () => real.dispatch);
  mock.module("@/lib/campaigns/automations", () => real.automations);
});

beforeEach(() => {
  stored = new Map();
  reads = { scheduled: none, stuck: none, active: none };
  dispatched = [];
  log.length = 0;
});

const run = async () => {
  const res = await GET(
    new NextRequest("https://app.example.test/api/cron/campaigns", {
      headers: { authorization: "Bearer s3cret" },
    }),
  );
  return { status: res.status, body: await res.json() };
};

describe("campaigns cron: giving up on a stuck send", () => {
  /** What the tick read: a send nobody has claimed for three hours. */
  const readAsAbandoned = () => {
    reads.stuck = () => ({
      data: [{ id: "c1", sending_started_at: ago(3 * HOUR), last_error: null }],
      error: null,
    });
  };

  test("a send nobody has claimed in two hours is marked failed, with why", async () => {
    readAsAbandoned();
    stored.set("c1", {
      id: "c1",
      status: "sending",
      sending_started_at: ago(3 * HOUR),
    });
    const { body } = await run();
    expect(stored.get("c1")?.status).toBe("failed");
    expect(stored.get("c1")?.last_error).toBe(
      "abandoned after two hours in sending",
    );
    expect(body.results.c1).toEqual({ abandoned: true });
    expect(dispatched).toEqual([]);
  });

  test("a send somebody claimed after the tick read it is left sending", async () => {
    readAsAbandoned();
    // A retry or a resume took it in between: its claim is fresh.
    stored.set("c1", {
      id: "c1",
      status: "sending",
      sending_started_at: ago(1_000),
    });
    const { body } = await run();
    expect(stored.get("c1")?.status).toBe("sending");
    expect(stored.get("c1")?.last_error).toBeUndefined();
    expect(body.results.c1).toEqual({ abandoned: false });
  });

  test("a send that finished after the tick read it stays finished", async () => {
    readAsAbandoned();
    stored.set("c1", {
      id: "c1",
      status: "sent",
      sending_started_at: ago(3 * HOUR),
    });
    const { body } = await run();
    expect(stored.get("c1")?.status).toBe("sent");
    expect(body.results.c1).toEqual({ abandoned: false });
  });

  test("a send quiet for less than two hours is resumed, not given up on", async () => {
    reads.stuck = () => ({
      data: [{ id: "c1", sending_started_at: ago(HOUR), last_error: null }],
      error: null,
    });
    stored.set("c1", {
      id: "c1",
      status: "sending",
      sending_started_at: ago(HOUR),
    });
    await run();
    expect(dispatched).toEqual([{ id: "c1", resume: true }]);
    expect(stored.get("c1")?.status).toBe("sending");
  });
});
