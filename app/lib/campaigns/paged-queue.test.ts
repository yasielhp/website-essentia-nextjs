import { describe, expect, spyOn, test } from "bun:test";
import type { Recipient } from "./audience-filter";
import {
  STUCK_AFTER_MS,
  dispatchCampaign,
  loadQueued,
  retryFailed,
} from "./dispatch";
import { argsOf, chainDb, has, type Step } from "./fake-db";
import {
  campaign,
  fakeClock,
  fakeSend,
  memoryDb,
  ok,
  rowsOf,
} from "./whatsapp-fixtures";

/**
 * The queue of a campaign and the failures of a retry are read to their end.
 * The database answers at most a thousand rows whatever range is asked for,
 * and a list cut there was taken for the whole of it.
 */

type Mem = ReturnType<typeof memoryDb>;

/**
 * `memoryDb` behind a database that, like the real one, never answers more
 * than a page of `campaign_recipients`, and honours the range it is asked for.
 * `failPage` makes the read that starts at that row fail.
 */
function paged(
  mem: Mem,
  failPage?: (from: number, chain: Step[]) => string | null,
) {
  type Chain = Record<string, (...args: unknown[]) => Chain>;
  const reads: { from: number; to: number; chain: Step[] }[] = [];
  const replay = (table: string, chain: Step[]) => {
    let query = mem.db.from(table) as unknown as Chain;
    // The in-memory database is a `chainDb` too, and would cut to the range
    // itself: only the outer one does, so a page is cut once.
    for (const step of chain) {
      if (step.name !== "range") query = query[step.name]!(...step.args);
    }
    return query as unknown as PromiseLike<{ data: unknown[] | null }>;
  };
  const { db } = chainDb(async (table, chain) => {
    const range = argsOf(chain, "range") as [number, number] | undefined;
    if (table !== "campaign_recipients" || has(chain, "update") || !range) {
      return replay(table, chain);
    }
    const [from, to] = range;
    reads.push({ from, to, chain: [...chain] });
    const failure = failPage?.(from, chain);
    if (failure) return { data: null, error: { message: failure } };
    const all = (await replay(table, chain)).data ?? [];
    // The whole table: `chainDb` cuts it to the range, as the database does.
    return { data: all, error: null };
  });
  return { db, reads };
}

const COUNT = 2_500;
// Each page starts where the rows received ended, and the read ends on an empty one.
const PAGES = [
  [0, 999],
  [1_000, 1_999],
  [2_000, 2_999],
  [2_500, 3_499],
];

const recipients = (count: number): Recipient[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `contact-${i + 1}`,
    email: null,
    firstName: `Nombre${i + 1}`,
    language: "en",
    phone: `+346${String(i + 1).padStart(8, "0")}`,
  }));

/** A WhatsApp dispatch with room for every row: the clock only moves on a sleep. */
function setup(mem: Mem, db: Mem["db"]) {
  const clock = fakeClock();
  const sender = fakeSend(() => ok("w"), clock);
  return {
    sender,
    deps: {
      db,
      resolveAudience: async () => recipients(COUNT),
      isWhatsAppConfigured: () => true,
      whatsapp: {
        send: sender.send,
        now: clock.now,
        sleep: clock.sleep,
        budgetMs: 3_600_000,
      },
    },
  };
}

describe("loadQueued", () => {
  test("2500 queued rows are read in three pages, all of them", async () => {
    const mem = memoryDb(rowsOf(COUNT));
    const { db, reads } = paged(mem);
    const rows = await loadQueued("camp-1", db);
    expect(rows).toHaveLength(COUNT);
    expect(new Set(rows.map((r) => r.id)).size).toBe(COUNT);
    expect(reads.map((r) => [r.from, r.to])).toEqual(PAGES);
  });

  test("every page is asked for in one total order: when queued, then the id", async () => {
    const mem = memoryDb(rowsOf(3));
    const { db, reads } = paged(mem);
    await loadQueued("camp-1", db);
    const orders = reads[0]!.chain
      .filter((step) => step.name === "order")
      .map((step) => step.args);
    expect(orders).toEqual([
      ["created_at", { ascending: true }],
      ["id", { ascending: true }],
    ]);
  });

  test("a page that fails fails the read: never the first thousand as if they were all", async () => {
    const mem = memoryDb(rowsOf(COUNT));
    const { db } = paged(mem, (from) => (from === 1_000 ? "timeout" : null));
    await expect(loadQueued("camp-1", db)).rejects.toThrow("timeout");
  });
});

describe("dispatchCampaign with a queue longer than a page", () => {
  test("sends all 2500 and only then calls the campaign sent", async () => {
    const mem = memoryDb(rowsOf(COUNT), {
      campaign: campaign({ status: "draft" }),
    });
    const { db } = paged(mem);
    const { deps, sender } = setup(mem, db);
    const result = await dispatchCampaign("camp-1", {}, deps);
    expect(result).toEqual({ ok: true, sent: COUNT, failed: 0 });
    expect(sender.calls).toHaveLength(COUNT);
    expect(mem.campaign.status).toBe("sent");
    expect(
      [...mem.rows.values()].filter((r) => r.status !== "sent"),
    ).toHaveLength(0);
  });

  test("a queue that cannot be read to its end sends nothing and leaves the campaign `sending`, to be resumed", async () => {
    const mem = memoryDb(rowsOf(COUNT), {
      campaign: campaign({ status: "draft" }),
    });
    const { db } = paged(mem, (from) => (from === 2_000 ? "timeout" : null));
    const { deps, sender } = setup(mem, db);
    const result = await dispatchCampaign("camp-1", {}, deps);
    expect(result).toMatchObject({ ok: false, error: "db" });
    expect(sender.calls).toHaveLength(0);
    // Not `sent` with a thousand rows out, and not `failed` either: its
    // audience is frozen and whole, and the cron's resume reads it again.
    expect(mem.campaign.status).toBe("sending");
    expect(String(mem.campaign.last_error)).toContain("timeout");
    expect(
      [...mem.rows.values()].filter((r) => r.status === "queued"),
    ).toHaveLength(COUNT);
  });
});

describe("a queue that cannot be read does not keep the campaign young for ever", () => {
  const HOUR = 3_600_000;

  test("a resume that could not read it leaves the send as old as it was, so the cron's two hours still run out", async () => {
    const startedAt = new Date(Date.now() - 1.5 * HOUR).toISOString();
    const mem = memoryDb(rowsOf(COUNT), {
      campaign: campaign({
        status: "sending",
        sending_started_at: startedAt,
      } as never),
    });
    const { db } = paged(mem, () => "table too long");
    const { deps } = setup(mem, db);
    const result = await dispatchCampaign("camp-1", { resume: true }, deps);
    expect(result).toMatchObject({ ok: false, error: "db" });
    expect(mem.campaign.status).toBe("sending");
    // The claim stamped it "now"; the failure gives it its age back.
    expect(mem.campaign.sending_started_at).toBe(startedAt);
    expect(String(mem.campaign.last_error)).toContain("table too long");
  });

  test("a first send that could not read it began now: that is its age", async () => {
    const before = Date.now();
    const mem = memoryDb(rowsOf(3), {
      campaign: campaign({ status: "draft" }),
    });
    const { db } = paged(mem, () => "timeout");
    const { deps } = setup(mem, db);
    await dispatchCampaign("camp-1", {}, deps);
    expect(mem.campaign.status).toBe("sending");
    expect(
      Date.parse(String(mem.campaign.sending_started_at)),
    ).toBeGreaterThanOrEqual(before);
  });

  test("a retry that could not read it is left as old as its reopening, not as its claim", async () => {
    const before = Date.now();
    const mem = memoryDb(rowsOf(3), {
      campaign: campaign({ status: "sent" }),
      rows: [{ id: "row-1", status: "failed", error: "Meta said no" }],
    });
    // The failures are read; the queue, afterwards, is not.
    const { db } = paged(mem, (_from, chain) =>
      has(chain, "or") ? null : "timeout",
    );
    const { deps } = setup(mem, db);
    const result = await retryFailed("camp-1", {}, deps);
    expect(result).toMatchObject({ ok: false, error: "db" });
    expect(mem.campaign.status).toBe("sending");
    // Stale enough for the cron's next tick to resume it.
    expect(Date.parse(String(mem.campaign.sending_started_at))).toBeLessThan(
      before - STUCK_AFTER_MS,
    );
  });
});

describe("retryFailed with more failures than a page", () => {
  const allFailed = () =>
    memoryDb(rowsOf(COUNT), {
      campaign: campaign({ status: "sent" }),
      rows: rowsOf(COUNT).map((r) => ({
        id: r.id,
        status: "failed",
        error: "131048: Spam rate limit hit",
      })),
    });

  test("all 2500 are requeued and sent, not the first thousand", async () => {
    const mem = allFailed();
    const { db, reads } = paged(mem);
    const { deps, sender } = setup(mem, db);
    const result = await retryFailed("camp-1", {}, deps);
    expect(result).toEqual({ ok: true, sent: COUNT, failed: 0 });
    expect(sender.calls).toHaveLength(COUNT);
    expect(mem.campaign.status).toBe("sent");
    // The failures were read in pages, with the retry's filter on each.
    const failures = reads.filter((r) => has(r.chain, "or"));
    expect(failures.map((r) => [r.from, r.to])).toEqual(PAGES);
    expect(
      failures[0]!.chain
        .filter((step) => step.name === "order")
        .map((step) => step.args[0]),
    ).toEqual(["id"]);
  });

  test("failures that cannot be read to their end: nothing is reopened or requeued, and the answer says so", async () => {
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    const mem = allFailed();
    const { db } = paged(mem, (from) => (from === 1_000 ? "timeout" : null));
    const { deps, sender } = setup(mem, db);
    const result = await retryFailed("camp-1", {}, deps);
    quiet.mockRestore();
    expect(result).toMatchObject({ ok: false, error: "db" });
    expect(String((result as { detail?: string }).detail)).toContain("timeout");
    expect(sender.calls).toHaveLength(0);
    expect(mem.campaign.status).toBe("sent");
    expect(
      [...mem.rows.values()].filter((r) => r.status === "failed"),
    ).toHaveLength(COUNT);
  });
});
