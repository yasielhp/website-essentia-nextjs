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
import {
  campaign,
  memoryDb,
  row,
  SOURCES,
  type MemoryDbOptions,
} from "./whatsapp-fixtures";

/**
 * The email sender when the row of an email that already left cannot be
 * written. The mailer and the template are replaced (nothing is sent, nothing
 * is rendered); the sender, the dispatch and the automation run are the real
 * ones.
 */

type Email = { to: string };

let batches: Email[][] = [];
/** The id Resend answers for each email, or null for one it did not take. */
let answer: (email: Email) => string | null;

const real = {
  send: { ...(await import("@/emails/send")) },
  template: { ...(await import("@/emails/templates/campaign")) },
};

let sendQueued: typeof import("./dispatch").sendQueued;
let dispatchCampaign: typeof import("./dispatch").dispatchCampaign;
let runAutomation: typeof import("./automations").runAutomation;

const KEY = process.env.RESEND_API_KEY;

beforeAll(async () => {
  process.env.NEXT_PUBLIC_APP_URL = "https://app.example.test";
  // Never used: the mailer below stands in for Resend.
  process.env.RESEND_API_KEY = "test-key";
  mock.module("@/emails/send", () => ({
    ...real.send,
    sendEmailBatch: async (emails: Email[]) => {
      batches.push(emails);
      const ids = emails.map(answer);
      return {
        sent: ids.filter(Boolean).length,
        ids,
        error: null,
      };
    },
  }));
  mock.module("@/emails/templates/campaign", () => ({
    ...real.template,
    campaignEmail: async () => ({ subject: "Hola", html: "<p>Hola</p>" }),
  }));
  ({ sendQueued, dispatchCampaign } = await import("./dispatch"));
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
    expect(mem.rows.get("row-1")?.provider_id).toBe("re_c1@example.test");
    expect(batches).toHaveLength(1);
  });

  test("a stamp that fails twice is not a quiet success: logged, and counted apart", async () => {
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
    // The email left; its row could not say so.
    expect(mem.status("row-1")).toBe("queued");
    expect(mem.status("row-2")).toBe("sent");
    expect(lines.some((l) => l.includes("row-1"))).toBe(true);
  });

  test("an email Resend did not take whose row cannot be failed stays queued, and is logged", async () => {
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    answer = () => null;
    const rows = [mailRow(1)];
    const mem = memoryDb(rows, {
      failUpdate: ({ patch }) =>
        patch.status === "failed" ? "connection reset" : null,
    });
    const result = await sendQueued(emailCampaign(), rows, {
      db: mem.db,
      sleep: noSleep,
    });
    const logged = quiet.mock.calls.length;
    quiet.mockRestore();
    // Nothing left, so sending it again later is right; no `unrecorded`.
    expect(result).toEqual({
      sent: 0,
      failed: 1,
      lastError: "no id returned",
    });
    expect(mem.status("row-1")).toBe("queued");
    expect(logged).toBeGreaterThan(0);
  });
});

describe("an email automation that cannot record what it sent", () => {
  const automated = () =>
    emailCampaign({
      status: "active",
      kind: "automated",
      trigger: { event: "segment_entry" },
      activated_at: "2026-11-01T00:00:00Z",
    });

  test("is paused with the reason, so the next tick does not mail the same people again", async () => {
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    const rows = [mailRow(1), mailRow(2)];
    const mem = memoryDb(rows, {
      campaign: automated(),
      failUpdate: cannotStamp("row-1"),
    });
    const result = await runAutomation(
      automated(),
      new Date("2026-11-17T12:00:00Z"),
      {
        db: mem.db,
        resolveAudience: async () => [],
        whatsapp: { sleep: noSleep },
      },
    );
    quiet.mockRestore();
    expect(batches).toHaveLength(1);
    expect(mem.status("row-1")).toBe("queued");
    expect(mem.campaign.status).toBe("paused");
    expect(mem.campaign.last_error).toBe(
      "[halted] 1 sent without being recorded",
    );
    expect(result).toMatchObject({
      sent: 1,
      halted: "1 sent without being recorded",
    });
  });

  test("one whose stamps are all written stays active", async () => {
    const rows = [mailRow(1)];
    const mem = memoryDb(rows, { campaign: automated() });
    const result = await runAutomation(
      automated(),
      new Date("2026-11-17T12:00:00Z"),
      { db: mem.db, resolveAudience: async () => [] },
    );
    expect(result).toEqual({ queued: 0, sent: 1, failed: 0 });
    expect(mem.campaign.status).toBe("active");
  });
});

describe("a one-off email campaign that cannot record what it sent", () => {
  test("finishes, and says on the campaign how many went out unrecorded", async () => {
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    const rows = [mailRow(1), mailRow(2)];
    const mem = memoryDb(rows, {
      campaign: emailCampaign({ status: "draft" }),
      failUpdate: cannotStamp("row-2"),
    });
    const recipients: Recipient[] = [1, 2].map((n) => ({
      id: `contact-${n}`,
      email: `c${n}@example.test`,
      firstName: `Nombre${n}`,
      language: "es",
    }));
    const result = await dispatchCampaign(
      "camp-1",
      {},
      {
        db: mem.db,
        resolveAudience: async () => recipients,
        whatsapp: { sleep: noSleep },
      },
    );
    quiet.mockRestore();
    expect(result).toEqual({ ok: true, sent: 1, failed: 0, unrecorded: 1 });
    expect(mem.campaign.status).toBe("sent");
    expect(mem.campaign.last_error).toBe("1 sent without being recorded");
  });
});
