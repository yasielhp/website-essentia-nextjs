import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import { argsOf, chainDb, has } from "@/lib/campaigns/fake-db";

/**
 * Sending and scheduling, through the real actions with the role check and the
 * database replaced. A campaign of an automated kind (an appointment notice
 * above all) is switched on and run by the cron: it is never sent in one go and
 * never scheduled, and the one-off kinds are unaffected.
 */

let kind: string | null = "standard";
let readError = false;
let missing = false;
let dispatched: string[] = [];
let updates: unknown[] = [];

const real = {
  admin: { ...(await import("@/lib/insforge-admin")) },
  guard: { ...(await import("@/lib/auth-guard")) },
  dispatch: { ...(await import("@/lib/campaigns/dispatch")) },
  cache: { ...(await import("next/cache")) },
};
let sendCampaignNow: typeof import("./campaigns").sendCampaignNow;
let scheduleCampaign: typeof import("./campaigns").scheduleCampaign;

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
  mock.module("@/lib/campaigns/dispatch", () => ({
    ...real.dispatch,
    dispatchCampaign: async (id: string) => {
      dispatched.push(id);
      return { ok: true, sent: 1, failed: 0 };
    },
  }));
  mock.module("@/lib/insforge-admin", () => ({
    getAdminClient: () => ({
      database: chainDb(async (table, chain) => {
        if (table !== "campaigns") return { data: [], error: null };
        if (has(chain, "update")) {
          updates.push(argsOf(chain, "update")?.[0]);
          return { data: [{ id: "camp-1" }], error: null };
        }
        if (readError) return { data: null, error: { message: "boom" } };
        return {
          data: missing
            ? null
            : { kind, channel: "email", audience: {}, content: {} },
          error: null,
        };
      }).db,
    }),
  }));
  ({ sendCampaignNow, scheduleCampaign } = await import("./campaigns"));
});

afterAll(() => {
  mock.module("next/cache", () => real.cache);
  mock.module("@/lib/auth-guard", () => real.guard);
  mock.module("@/lib/campaigns/dispatch", () => real.dispatch);
  mock.module("@/lib/insforge-admin", () => real.admin);
});

beforeEach(() => {
  kind = "standard";
  readError = false;
  missing = false;
  dispatched = [];
  updates = [];
});

const AUTOMATED = [
  "automated",
  "autoresponder",
  "rss",
  "dateBased",
  "appointment",
];
const FUTURE = new Date(Date.now() + 3_600_000).toISOString();

describe("sendCampaignNow", () => {
  test.each(AUTOMATED)(
    "an automated kind (%s) is locked and nothing is dispatched",
    async (k) => {
      kind = k;
      expect(await sendCampaignNow("t", "camp-1")).toEqual({
        ok: false,
        error: "locked",
      });
      expect(dispatched).toEqual([]);
    },
  );

  test("a one-off kind is dispatched as before", async () => {
    for (const k of ["standard", "split"]) {
      kind = k;
      dispatched = [];
      expect(await sendCampaignNow("t", "camp-1")).toMatchObject({ ok: true });
      expect(dispatched).toEqual(["camp-1"]);
    }
  });

  test("a campaign that cannot be read is not sent on a guess", async () => {
    readError = true;
    expect(await sendCampaignNow("t", "camp-1")).toEqual({
      ok: false,
      error: "db",
    });
    expect(dispatched).toEqual([]);
  });

  test("a campaign that is not there is left to the dispatch, which says not claimable", async () => {
    missing = true;
    await sendCampaignNow("t", "camp-1");
    expect(dispatched).toEqual(["camp-1"]);
  });
});

describe("scheduleCampaign", () => {
  test.each(AUTOMATED)(
    "an automated kind (%s) is locked and nothing is scheduled",
    async (k) => {
      kind = k;
      expect(await scheduleCampaign("t", "camp-1", FUTURE)).toEqual({
        ok: false,
        error: "locked",
      });
      expect(updates).toEqual([]);
    },
  );

  test("a one-off kind is scheduled as before", async () => {
    for (const k of ["standard", "split"]) {
      kind = k;
      updates = [];
      expect(await scheduleCampaign("t", "camp-1", FUTURE)).toEqual({
        ok: true,
      });
      expect(updates).toHaveLength(1);
      expect(updates[0]).toMatchObject({ status: "scheduled" });
    }
  });

  test("a past time is still refused first", async () => {
    kind = "appointment";
    expect(
      await scheduleCampaign("t", "camp-1", "2020-01-01T00:00:00Z"),
    ).toEqual({
      ok: false,
      error: "past",
    });
  });
});
