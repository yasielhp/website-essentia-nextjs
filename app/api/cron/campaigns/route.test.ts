import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import { NextRequest } from "next/server";
import { argsOf, chainDb, filters, has } from "@/lib/campaigns/fake-db";
import { RUN_FAILED_ERROR } from "@/lib/campaigns/run-markers";

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
/** What a run of each active campaign does; the default finishes with nothing due. */
let automation: (campaign: { id: string }) => Promise<unknown>;
let ran: string[] = [];

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
    runAutomation: async (campaign: { id: string }) => {
      ran.push(campaign.id);
      return automation(campaign);
    },
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
  automation = async () => ({ queued: 0, sent: 0, failed: 0 });
  ran = [];
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

const failed = (message: string): Answer => ({
  data: null,
  error: { message },
});

const campaignWrites = () =>
  log.filter((q) => q.table === "campaigns" && has(q.chain, "update"));

describe("campaigns cron: a read that fails is not a quiet tick", () => {
  test("the stuck sends cannot be read: it is logged and answered, and the rest still runs", async () => {
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    reads.scheduled = () => ({ data: [{ id: "s1" }], error: null });
    reads.stuck = () => failed("connection reset");
    reads.active = () => ({
      data: [{ id: "a1", status: "active", kind: "automated", trigger: {} }],
      error: null,
    });
    const { status, body } = await run();
    const lines = quiet.mock.calls.map((c) => String(c[0]));
    quiet.mockRestore();
    expect(status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.errors).toEqual({ stuck: "query failed" });
    expect(lines.some((l) => l.includes("stuck"))).toBe(true);
    expect(dispatched).toEqual([{ id: "s1", resume: false }]);
    expect(ran).toEqual(["a1"]);
  });

  test("the active campaigns cannot be read: the same, and no automation is taken as run", async () => {
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    reads.scheduled = () => ({ data: [{ id: "s1" }], error: null });
    reads.active = () => failed("connection reset");
    const { status, body } = await run();
    const lines = quiet.mock.calls.map((c) => String(c[0]));
    quiet.mockRestore();
    expect(status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.errors).toEqual({ active: "query failed" });
    expect(lines.some((l) => l.includes("active"))).toBe(true);
    expect(dispatched).toEqual([{ id: "s1", resume: false }]);
    expect(ran).toEqual([]);
  });

  test("a tick whose reads all answer is ok, with no errors in its answer", async () => {
    const { status, body } = await run();
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true, results: {} });
  });
});

describe("campaigns cron: an automation whose run throws", () => {
  const active = (id: string, over: Record<string, unknown> = {}): Stored => ({
    id,
    status: "active",
    kind: "automated",
    trigger: {},
    last_error: null,
    ...over,
  });
  const serve = (...campaigns: Stored[]) => {
    for (const c of campaigns) stored.set(c.id, { ...c });
    reads.active = () => ({ data: campaigns, error: null });
  };

  test("leaves a stable mark on the campaign, which stays active, and the others still run", async () => {
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    serve(active("a1"), active("a2"));
    automation = async ({ id }) => {
      if (id === "a1") {
        throw new Error(
          "duplicate key (campaign_id, phone)=(a1, +34600000001)",
        );
      }
      return { queued: 1, sent: 1, failed: 0 };
    };
    const { status, body } = await run();
    quiet.mockRestore();
    expect(stored.get("a1")?.last_error).toBe(RUN_FAILED_ERROR);
    expect(stored.get("a1")?.status).toBe("active");
    // Nothing of the error's own text, which can name a client, is stored.
    expect(String(stored.get("a1")?.last_error)).not.toContain("+34");
    expect(body.results.a1).toMatchObject({ error: expect.any(String) });
    expect(ran).toEqual(["a1", "a2"]);
    expect(stored.get("a2")?.last_error).toBeNull();
    expect(body.results.a2).toEqual({ queued: 1, sent: 1, failed: 0 });
    // A run that throws is that campaign's problem, not the tick's.
    expect(status).toBe(200);
  });

  test("a campaign already marked is not written again every fifteen minutes", async () => {
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    serve(active("a1", { last_error: RUN_FAILED_ERROR }));
    automation = async () => {
      throw new Error("still down");
    };
    await run();
    quiet.mockRestore();
    expect(campaignWrites()).toHaveLength(0);
    expect(stored.get("a1")?.last_error).toBe(RUN_FAILED_ERROR);
  });

  test("a campaign paused while it ran keeps the reason it was paused for", async () => {
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    serve(active("a1"));
    stored.set("a1", {
      ...active("a1"),
      status: "paused",
      last_error: "[halted] 132000: Template param mismatch",
    });
    automation = async () => {
      throw new Error("boom");
    };
    await run();
    quiet.mockRestore();
    expect(stored.get("a1")?.last_error).toBe(
      "[halted] 132000: Template param mismatch",
    );
  });
});
