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
import type { Recipient } from "./audience-filter";
import { argsOf, has } from "./fake-db";
import { NO_ANSWER_ERROR } from "./run-markers";
import {
  campaign,
  memoryDb,
  row,
  SOURCES,
  type MemoryDbOptions,
} from "./whatsapp-fixtures";

/**
 * The email sender claims its rows before it mails them, and what that buys:
 * an email that left is never mailed again, whatever happened to its row. The
 * mailer and the template are replaced (nothing is sent, nothing is rendered);
 * the sender, the dispatch, the retry and the automation run are the real ones.
 */

type Email = {
  to: string;
  subject: string;
  blindCopy?: boolean;
  tags?: Record<string, string>;
  headers?: Record<string, string>;
};

let batches: Email[][] = [];
/** The id Resend answers for each email, or null for one it did not take. */
let answer: (email: Email) => string | null;
/** Runs when the mailer is called, before it answers: a process dying there throws. */
let onSend: (emails: Email[]) => void | Promise<void>;
/**
 * Whole-chunk failures, one per call to the mailer, before `answer` is asked:
 * `rejected` is Resend saying no (nothing left); without it, nobody knows.
 */
let failures: {
  error: string;
  rejected: boolean;
  /** Resend did take the request; it is the answer that never arrived. */
  landed?: boolean;
}[] = [];
/** The idempotency key of every call to the mailer. */
let keys: (string | undefined)[] = [];
/** What Resend answered under each key, and how many times it delivered it. */
let taken = new Map<string, unknown>();
let deliveries = new Map<string, number>();

const real = {
  send: { ...(await import("@/emails/send")) },
  template: { ...(await import("@/emails/templates/campaign")) },
};

let sendQueued: typeof import("./dispatch").sendQueued;
let chunkKey: typeof import("./dispatch").chunkKey;
let dispatchCampaign: typeof import("./dispatch").dispatchCampaign;
let retryFailed: typeof import("./dispatch").retryFailed;
let reconcileAllInterrupted: typeof import("./dispatch").reconcileAllInterrupted;
let runAutomation: typeof import("./automations").runAutomation;

const KEY = process.env.RESEND_API_KEY;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_APP_URL = "https://app.example.test";
  // Never used: the mailer below stands in for Resend.
  process.env.RESEND_API_KEY = "test-key";
  mock.module("@/emails/send", () => ({
    ...real.send,
    sendEmailBatch: async (
      emails: Email[],
      options: { idempotencyKey?: string } = {},
    ) => {
      batches.push(emails);
      keys.push(options.idempotencyKey);
      await onSend(emails);
      const key = options.idempotencyKey;
      // Resend's side of an idempotency key: the first request it takes under
      // a key is the one delivery, and its answer is what the same key gets
      // from then on.
      const take = () => {
        const kept = key === undefined ? undefined : taken.get(key);
        if (kept) return kept;
        const ids = emails.map(answer);
        const result = {
          sent: ids.filter(Boolean).length,
          ids,
          error: null,
          rejected: false,
        };
        if (key !== undefined) {
          taken.set(key, result);
          deliveries.set(key, (deliveries.get(key) ?? 0) + 1);
        }
        return result;
      };
      const failure = failures.shift();
      if (failure) {
        if (failure.landed) take();
        return {
          sent: 0,
          ids: emails.map(() => null),
          error: failure.error,
          rejected: failure.rejected,
        };
      }
      return take();
    },
  }));
  mock.module("@/emails/templates/campaign", () => ({
    ...real.template,
    campaignEmail: async ({ content }: { content: { subject: string } }) => ({
      subject: content.subject,
      html: "<p>Hola</p>",
    }),
  }));
  ({
    sendQueued,
    chunkKey,
    dispatchCampaign,
    retryFailed,
    reconcileAllInterrupted,
  } = await import("./dispatch"));
  ({ runAutomation } = await import("./automations"));
});

afterAll(() => {
  mock.module("@/emails/send", () => real.send);
  mock.module("@/emails/templates/campaign", () => real.template);
  if (KEY === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = KEY;
});

beforeEach(() => {
  batches = [];
  answer = (email) => `re_${email.to}`;
  onSend = () => {};
  failures = [];
  keys = [];
  taken = new Map();
  deliveries = new Map();
});

const emailCampaign = (over: Record<string, unknown> = {}) =>
  campaign({
    channel: "email",
    content: {
      en: { subject: "Hi", preheader: "", title: "", doc: null },
      es: { subject: "Hola", preheader: "", title: "", doc: null },
      whatsapp: { templateId: null, params: SOURCES },
    } as never,
    ...over,
  });

const mailRow = (n: number) =>
  row(n, { email: `c${n}@example.test`, phone: null });

/** Fails the write that stamps `id` as sent, on these attempts (all by default). */
const cannotStamp =
  (id: string, attempts?: number[]): MemoryDbOptions["failUpdate"] =>
  ({ id: rowId, patch, attempt }) =>
    rowId === id &&
    patch.status === "sent" &&
    (attempts === undefined || attempts.includes(attempt))
      ? "connection reset"
      : null;

const noSleep = async () => {};
const MINUTE = 60_000;
const T0 = Date.parse("2026-11-17T12:00:00Z");
/** Everybody who was mailed, across every call to the mailer. */
const mailed = () => batches.flat().map((email) => email.to);

describe("sendQueued on email claims its rows before mailing them", () => {
  test("each row is `sending`, with its claim stamped, by the time Resend is called", async () => {
    const rows = [mailRow(1), mailRow(2)];
    const mem = memoryDb(rows);
    let seen: (string | undefined)[] = [];
    let claimedAt: (string | null | undefined)[] = [];
    onSend = () => {
      seen = rows.map((r) => mem.status(r.id));
      claimedAt = rows.map((r) => mem.rows.get(r.id)?.claimed_at);
    };
    const result = await sendQueued(emailCampaign(), rows, {
      db: mem.db,
      now: () => T0,
    });
    expect(seen).toEqual(["sending", "sending"]);
    expect(claimedAt).toEqual([
      new Date(T0).toISOString(),
      new Date(T0).toISOString(),
    ]);
    expect(result).toEqual({ sent: 2, failed: 0, lastError: null });
    expect(mem.status("row-1")).toBe("sent");
    expect(mem.rows.get("row-1")?.provider_id).toBe("re_c1@example.test");
  });

  test("the claim is one conditional UPDATE per chunk: only rows still queued", async () => {
    const rows = [mailRow(1), mailRow(2)];
    const mem = memoryDb(rows);
    await sendQueued(emailCampaign(), rows, { db: mem.db });
    const claims = mem.log.filter(
      (q) =>
        q.table === "campaign_recipients" &&
        (argsOf(q.chain, "update")?.[0] as { status?: string })?.status ===
          "sending",
    );
    expect(claims).toHaveLength(1);
    const [{ chain }] = claims;
    expect(argsOf(chain, "in")).toEqual(["id", ["row-1", "row-2"]]);
    expect(argsOf(chain, "eq")).toEqual(["status", "queued"]);
    expect(has(chain, "select")).toBe(true);
  });

  test("a row somebody else already took is not mailed, and is not ours to count", async () => {
    const rows = [mailRow(1), mailRow(2)];
    const mem = memoryDb(rows, {
      rows: [{ id: "row-1", status: "sending", claimed_at: "x" }],
    });
    const result = await sendQueued(emailCampaign(), rows, { db: mem.db });
    expect(mailed()).toEqual(["c2@example.test"]);
    expect(result).toEqual({ sent: 1, failed: 0, lastError: null });
    expect(mem.status("row-1")).toBe("sending");
  });

  test("two invocations at once mail each person once", async () => {
    const rows = [1, 2, 3, 4, 5].map(mailRow);
    const mem = memoryDb(rows);
    const [a, b] = await Promise.all([
      sendQueued(emailCampaign(), rows, { db: mem.db }),
      sendQueued(emailCampaign(), rows, { db: mem.db }),
    ]);
    expect(mailed().sort()).toEqual(rows.map((r) => r.email as string).sort());
    expect(a.sent + b.sent).toBe(5);
    expect(a.failed + b.failed).toBe(0);
  });

  test("a claim that cannot be made mails nobody and leaves the queue for a resume", async () => {
    const rows = [mailRow(1), mailRow(2)];
    const mem = memoryDb(rows, {
      failUpdate: ({ patch }) =>
        patch.status === "sending" ? "connection reset" : null,
    });
    const result = await sendQueued(emailCampaign(), rows, { db: mem.db });
    expect(batches).toEqual([]);
    expect(result).toEqual({
      sent: 0,
      failed: 0,
      lastError: "db: connection reset",
      remaining: 2,
    });
    expect(mem.status("row-1")).toBe("queued");
  });

  test("what goes to Resend is what always went: order, subjects of an A/B test, tags, headers", async () => {
    const rows = [
      row(1, { email: "c1@example.test", phone: null, variant: "a" }),
      row(2, { email: "c2@example.test", phone: null, variant: "b" }),
      row(3, { email: "c3@example.test", phone: null, variant: "a" }),
    ];
    const mem = memoryDb(rows);
    const split = emailCampaign({
      kind: "split",
      content: {
        en: { subject: "Hi", preheader: "", title: "", doc: null },
        es: {
          subject: "Hola A",
          subjectB: "Hola B",
          preheader: "",
          title: "",
          doc: null,
        },
        whatsapp: { templateId: null, params: SOURCES },
      } as never,
    });
    const result = await sendQueued(split, rows, { db: mem.db });
    expect(result).toEqual({ sent: 3, failed: 0, lastError: null });
    expect(batches).toHaveLength(1);
    expect(batches[0]!.map((e) => [e.to, e.subject])).toEqual([
      ["c1@example.test", "Hola A"],
      ["c2@example.test", "Hola B"],
      ["c3@example.test", "Hola A"],
    ]);
    expect(batches[0]![0]).toMatchObject({
      blindCopy: false,
      tags: { campaign_id: "camp-1" },
      headers: {
        "List-Unsubscribe":
          "<https://app.example.test/es/newsletter/unsubscribe?token=>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
  });
});

describe("sendQueued on email: the stamp of an email that already left", () => {
  test("a stamp that fails once is written on the second try", async () => {
    const rows = [mailRow(1), mailRow(2)];
    const mem = memoryDb(rows, { failUpdate: cannotStamp("row-1", [1]) });
    const result = await sendQueued(emailCampaign(), rows, {
      db: mem.db,
      sleep: noSleep,
    });
    expect(result).toEqual({ sent: 2, failed: 0, lastError: null });
    expect(mem.status("row-1")).toBe("sent");
    expect(batches).toHaveLength(1);
  });

  test("a stamp that fails twice leaves the row `sending`, never back in the queue", async () => {
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    const rows = [mailRow(1), mailRow(2)];
    const mem = memoryDb(rows, { failUpdate: cannotStamp("row-1") });
    const result = await sendQueued(emailCampaign(), rows, {
      db: mem.db,
      sleep: noSleep,
    });
    const lines = quiet.mock.calls.map((c) => String(c[0]));
    quiet.mockRestore();
    expect(result).toEqual({
      sent: 1,
      failed: 0,
      lastError: null,
      unrecorded: 1,
    });
    expect(mem.status("row-1")).toBe("sending");
    expect(mem.status("row-2")).toBe("sent");
    expect(lines.some((l) => l.includes("row-1"))).toBe(true);
  });

  test("an email Resend did not take is failed with what Resend said", async () => {
    answer = () => null;
    const rows = [mailRow(1)];
    const mem = memoryDb(rows);
    const result = await sendQueued(emailCampaign(), rows, { db: mem.db });
    expect(result).toEqual({
      sent: 0,
      failed: 1,
      lastError: "no id returned",
    });
    expect(mem.status("row-1")).toBe("failed");
    expect(mem.error("row-1")).toBe("no id returned");
  });
});

describe("sendQueued on email: a chunk that fails", () => {
  const rows = () => [mailRow(1), mailRow(2)];

  test("refused by Resend: the chunk is tried once more, as it always was", async () => {
    failures = [{ error: "Too many requests", rejected: true }];
    const queued = rows();
    const mem = memoryDb(queued);
    const sleeps: number[] = [];
    const result = await sendQueued(emailCampaign(), queued, {
      db: mem.db,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });
    expect(batches).toHaveLength(2);
    expect(batches[1]).toEqual(batches[0]!);
    expect(sleeps).toEqual([2000]);
    expect(result).toEqual({ sent: 2, failed: 0, lastError: null });
    expect(mem.status("row-1")).toBe("sent");
  });

  test("refused twice: the rows fail with what Resend said, and a retry may send them again", async () => {
    failures = [
      { error: "Too many requests", rejected: true },
      { error: "Too many requests", rejected: true },
    ];
    const queued = rows();
    const mem = memoryDb(queued);
    const result = await sendQueued(emailCampaign(), queued, {
      db: mem.db,
      sleep: noSleep,
    });
    expect(batches).toHaveLength(2);
    expect(result).toEqual({
      sent: 0,
      failed: 2,
      lastError: "Too many requests",
    });
    expect(mem.status("row-1")).toBe("failed");
    expect(mem.error("row-1")).toBe("Too many requests");
  });

  test("the retry of a refused chunk carries the same key and the same emails", async () => {
    failures = [{ error: "Too many requests", rejected: true }];
    const queued = rows();
    const mem = memoryDb(queued);
    await sendQueued(emailCampaign(), queued, { db: mem.db, sleep: noSleep });
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]!);
  });
});

describe("sendQueued on email: a chunk nobody knows the fate of", () => {
  const rows = () => [mailRow(1), mailRow(2)];
  const NO_ANSWER = "Unable to fetch data. The request could not be resolved.";
  const cut = (landed: boolean) => ({
    error: NO_ANSWER,
    rejected: false,
    landed,
  });
  const send = async (deadlineAt?: number) => {
    const queued = rows();
    const mem = memoryDb(queued);
    const sleeps: number[] = [];
    const result = await sendQueued(emailCampaign(), queued, {
      db: mem.db,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      deadlineAt,
    });
    return { mem, sleeps, result };
  };

  test("every chunk goes with a key of its own: the campaign and a digest of its rows", async () => {
    const queued = rows();
    const mem = memoryDb(queued);
    await sendQueued(emailCampaign(), queued, { db: mem.db });
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^campaign-camp-1\/[0-9a-f]{32}$/);
    expect(keys[0]).toBe(chunkKey("camp-1", ["row-2", "row-1"]));
    expect(chunkKey("camp-1", ["row-1", "row-2"])).toBe(keys[0]!);
    expect(chunkKey("camp-1", ["row-1", "row-3"])).not.toBe(keys[0]!);
    expect(chunkKey("camp-2", ["row-1", "row-2"])).not.toBe(keys[0]!);
    expect(
      chunkKey(
        "3f0c1a52-9d0e-4c57-8a55-0d2a2b6f1c11",
        Array.from({ length: 100 }, (_, i) => `row-${i}`),
      ).length,
    ).toBeLessThanOrEqual(256);
  });

  test("a brief cut after Resend took it: asked again under the same key, everybody is sent, once", async () => {
    failures = [cut(true)];
    const { mem, sleeps, result } = await send();
    expect(result).toEqual({ sent: 2, failed: 0, lastError: null });
    expect(mem.status("row-1")).toBe("sent");
    expect(mem.rows.get("row-1")?.provider_id).toBe("re_c1@example.test");
    expect(mem.rows.get("row-2")?.provider_id).toBe("re_c2@example.test");
    // Two requests, one key, the same emails: one delivery.
    expect(batches).toHaveLength(2);
    expect(batches[1]).toEqual(batches[0]!);
    expect(keys[1]).toBe(keys[0]!);
    expect(deliveries.get(keys[0]!)).toBe(1);
    expect(sleeps).toEqual([2000]);
  });

  test("a brief cut before Resend took it: the second request is the one delivery", async () => {
    failures = [cut(false)];
    const { mem, result } = await send();
    expect(result).toEqual({ sent: 2, failed: 0, lastError: null });
    expect(mem.status("row-2")).toBe("sent");
    expect(deliveries.get(keys[0]!)).toBe(1);
  });

  test("Resend still busy with the first request (a 409 about the key) is asked again too", async () => {
    failures = [
      cut(true),
      { error: "concurrent_idempotent_requests", rejected: false },
    ];
    const { result, sleeps } = await send();
    expect(result).toEqual({ sent: 2, failed: 0, lastError: null });
    expect(sleeps).toEqual([2000, 5000]);
    expect(deliveries.get(keys[0]!)).toBe(1);
  });

  test("a long cut: three more tries, further apart, then the rows fail as unconfirmed with no answer", async () => {
    failures = [cut(false), cut(false), cut(false), cut(false)];
    const { mem, sleeps, result } = await send();
    expect(batches).toHaveLength(4);
    expect(new Set(keys).size).toBe(1);
    expect(sleeps).toEqual([2000, 5000, 10_000]);
    expect(result).toEqual({
      sent: 0,
      failed: 2,
      lastError: `[unconfirmed] no_answer: ${NO_ANSWER}`,
    });
    expect(mem.status("row-1")).toBe("failed");
    expect(mem.error("row-1")).toBe(`[unconfirmed] no_answer: ${NO_ANSWER}`);
    expect(mem.error("row-1")?.startsWith(NO_ANSWER_ERROR)).toBe(true);
  });

  test("no try is waited for past the function's deadline", async () => {
    failures = [cut(false), cut(false), cut(false), cut(false)];
    // Room for the 2 s wait and its margin, not for the 5 s one.
    const { sleeps } = await send(Date.now() + 9_000);
    expect(sleeps).toEqual([2000]);
    expect(batches).toHaveLength(2);
  });

  test("a refusal after a cut is still tried once more, as a refusal always was", async () => {
    failures = [cut(false), { error: "Too many requests", rejected: true }];
    const { result, sleeps } = await send();
    expect(result).toEqual({ sent: 2, failed: 0, lastError: null });
    expect(sleeps).toEqual([2000, 2000]);
  });

  test('a long cut on a one-off campaign: it says so, and "retry the failed ones" touches nothing', async () => {
    failures = [cut(false), cut(false), cut(false), cut(false)];
    const queued = rows();
    const mem = memoryDb(queued, {
      campaign: emailCampaign({ status: "draft" }),
    });
    const deps = {
      db: mem.db,
      resolveAudience: async (): Promise<Recipient[]> =>
        [1, 2].map((n) => ({
          id: `contact-${n}`,
          email: `c${n}@example.test`,
          firstName: `Nombre${n}`,
          language: "es" as const,
        })),
      whatsapp: { sleep: noSleep },
    };
    const first = await dispatchCampaign("camp-1", {}, deps);
    expect(first).toEqual({ ok: true, sent: 0, failed: 2 });
    expect(mem.campaign.status).toBe("sent");
    expect(mem.campaign.last_error).toBe(
      `[unconfirmed] no_answer: ${NO_ANSWER}`,
    );

    const writesBefore = mem.campaignWrites.length;
    const retried = await retryFailed("camp-1", {}, deps);
    expect(retried).toEqual({ ok: false, error: "nothing_to_retry" });
    // Not reopened in vain, and the reason it gave is still there.
    expect(mem.campaignWrites).toHaveLength(writesBefore);
    expect(mem.campaign.status).toBe("sent");
    expect(mem.campaign.last_error).toBe(
      `[unconfirmed] no_answer: ${NO_ANSWER}`,
    );
    expect(batches).toHaveLength(4);
    expect(mem.status("row-1")).toBe("failed");
  });

  test("an email retry with a plain failure among them still sends that one", async () => {
    const queued = [mailRow(1), mailRow(2)];
    const mem = memoryDb(queued, {
      campaign: emailCampaign({ status: "sent" }),
      rows: [
        { id: "row-1", status: "failed", error: "Too many requests" },
        {
          id: "row-2",
          status: "failed",
          error: `[unconfirmed] no_answer: ${NO_ANSWER}`,
        },
      ],
    });
    const result = await retryFailed(
      "camp-1",
      {},
      { db: mem.db, whatsapp: { sleep: noSleep } },
    );
    expect(result).toEqual({ ok: true, sent: 1, failed: 0 });
    expect(mailed()).toEqual(["c1@example.test"]);
    expect(mem.status("row-2")).toBe("failed");
  });
});

describe("an email automation whose stamp failed after the email left", () => {
  const automated = () =>
    emailCampaign({
      status: "active",
      kind: "automated",
      trigger: { event: "segment_entry" },
      activated_at: "2026-11-01T00:00:00Z",
    });
  const tick = (mem: ReturnType<typeof memoryDb>, at: number) =>
    runAutomation(automated(), new Date(at), {
      db: mem.db,
      resolveAudience: async () => [],
      whatsapp: { sleep: noSleep, now: () => at },
    });

  test("stays active, says so on the campaign, and no later tick mails that person again", async () => {
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    const rows = [mailRow(1), mailRow(2)];
    const mem = memoryDb(rows, {
      campaign: automated(),
      failUpdate: cannotStamp("row-1"),
    });
    const first = await tick(mem, T0);
    expect(first).toEqual({ queued: 0, sent: 1, failed: 0 });
    expect(mem.campaign.status).toBe("active");
    expect(mem.campaign.last_error).toBe("1 sent without being recorded");
    expect(mem.status("row-1")).toBe("sending");

    // The next tick, a quarter of an hour on: the row is settled as
    // unconfirmed, and nobody is mailed.
    await tick(mem, T0 + 15 * MINUTE);
    await tick(mem, T0 + 30 * MINUTE);
    quiet.mockRestore();
    expect(batches).toHaveLength(1);
    expect(mailed()).toEqual(["c1@example.test", "c2@example.test"]);
    expect(mem.status("row-1")).toBe("failed");
    expect(mem.error("row-1")).toBe("[unconfirmed] interrupted");
    expect(mem.campaign.status).toBe("active");
  });

  test("a process that dies between the claim and the answer: unconfirmed, never mailed again", async () => {
    const rows = [mailRow(1)];
    const mem = memoryDb(rows, { campaign: automated() });
    onSend = () => {
      throw new Error("function killed");
    };
    await expect(tick(mem, T0)).rejects.toThrow("function killed");
    expect(mem.status("row-1")).toBe("sending");

    onSend = () => {};
    await tick(mem, T0 + 15 * MINUTE);
    expect(batches).toHaveLength(1);
    expect(mem.status("row-1")).toBe("failed");
    expect(mem.error("row-1")).toBe("[unconfirmed] interrupted");
    expect(mem.campaign.failed_count).toBe(1);
  });

  test("one whose stamps are all written goes on as before", async () => {
    const rows = [mailRow(1)];
    const mem = memoryDb(rows, { campaign: automated() });
    expect(await tick(mem, T0)).toEqual({ queued: 0, sent: 1, failed: 0 });
    expect(mem.campaign.status).toBe("active");
    expect(mem.campaign.last_error ?? null).toBeNull();
  });
});

describe("a one-off email campaign whose stamp failed after the email left", () => {
  const recipients: Recipient[] = [1, 2].map((n) => ({
    id: `contact-${n}`,
    email: `c${n}@example.test`,
    firstName: `Nombre${n}`,
    language: "es",
  }));
  const deps = (mem: ReturnType<typeof memoryDb>) => ({
    db: mem.db,
    resolveAudience: async () => recipients,
    whatsapp: { sleep: noSleep },
  });

  test("finishes, says how many went out unrecorded, and a retry does not mail them again", async () => {
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    // Resend did not take the first; the second left and its stamp failed.
    answer = (email) =>
      email.to === "c1@example.test" ? null : `re_${email.to}`;
    const rows = [mailRow(1), mailRow(2)];
    const mem = memoryDb(rows, {
      campaign: emailCampaign({ status: "draft" }),
      failUpdate: cannotStamp("row-2"),
    });
    const result = await dispatchCampaign("camp-1", {}, deps(mem));
    expect(result).toEqual({ ok: true, sent: 0, failed: 1, unrecorded: 1 });
    expect(mem.campaign.status).toBe("sent");
    expect(mem.status("row-2")).toBe("sending");

    // The cron settles the row once its claim is five minutes old.
    await reconcileAllInterrupted(Date.now() + 6 * MINUTE, mem.db);
    expect(mem.error("row-2")).toBe("[unconfirmed] interrupted");

    // "Retry the failed ones": the one Resend refused, and only that one.
    answer = (email) => `re_${email.to}`;
    const retried = await retryFailed("camp-1", {}, deps(mem));
    quiet.mockRestore();
    expect(retried).toEqual({ ok: true, sent: 1, failed: 0 });
    expect(batches).toHaveLength(2);
    expect(batches[1]!.map((e) => e.to)).toEqual(["c1@example.test"]);
    expect(mem.status("row-1")).toBe("sent");
    expect(mem.status("row-2")).toBe("failed");
  });

  test("a campaign whose claim failed stays `sending`, to be resumed, instead of closing with its queue", async () => {
    const rows = [mailRow(1), mailRow(2)];
    const mem = memoryDb(rows, {
      campaign: emailCampaign({ status: "draft" }),
      failUpdate: ({ patch }) =>
        patch.status === "sending" && "claimed_at" in patch
          ? "connection reset"
          : null,
    });
    const result = await dispatchCampaign("camp-1", {}, deps(mem));
    expect(result).toMatchObject({ ok: true, sent: 0, remaining: 2 });
    expect(mem.campaign.status).toBe("sending");
    expect(mem.campaign.last_error).toBe("db: connection reset");
    expect(batches).toEqual([]);
  });

  test("a resume settles what a dead process left `sending` and mails only the queue", async () => {
    const rows = [mailRow(1), mailRow(2)];
    const mem = memoryDb(rows, {
      campaign: emailCampaign({
        status: "sending",
        sending_started_at: "2026-01-01T00:00:00Z",
      } as never),
      rows: [
        { id: "row-1", status: "sending", claimed_at: "2026-01-01T00:00:00Z" },
      ],
    });
    const result = await dispatchCampaign(
      "camp-1",
      { resume: true },
      deps(mem),
    );
    expect(result).toEqual({ ok: true, sent: 1, failed: 0 });
    expect(mailed()).toEqual(["c2@example.test"]);
    expect(mem.error("row-1")).toBe("[unconfirmed] interrupted");
  });
});
