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
import { chainDb } from "@/lib/campaigns/fake-db";

/** The state cards of the campaigns list: counts, or the fact they could not be counted. */
let rows: { status: string }[] = [];
let failure: string | null = null;

const real = {
  guard: { ...(await import("@/lib/auth-guard")) },
  admin: { ...(await import("@/lib/insforge-admin")) },
};
let fetchCampaignStatusCounts: typeof import("./campaigns").fetchCampaignStatusCounts;

beforeAll(async () => {
  mock.module("@/lib/auth-guard", () => ({
    ...real.guard,
    requireRole: async () => ({
      userId: "a",
      email: "a@e.test",
      role: "admin",
    }),
  }));
  mock.module("@/lib/insforge-admin", () => ({
    getAdminClient: () => ({
      database: chainDb(async () =>
        failure
          ? { data: null, error: { message: failure } }
          : { data: rows, error: null },
      ).db,
    }),
  }));
  ({ fetchCampaignStatusCounts } = await import("./campaigns"));
});
afterAll(() => {
  mock.module("@/lib/auth-guard", () => real.guard);
  mock.module("@/lib/insforge-admin", () => real.admin);
});
beforeEach(() => {
  rows = [];
  failure = null;
});

describe("fetchCampaignStatusCounts", () => {
  test("counts by state, and every campaign in 'all'", async () => {
    rows = [{ status: "draft" }, { status: "draft" }, { status: "sent" }];
    expect(await fetchCampaignStatusCounts("t")).toMatchObject({
      all: 3,
      draft: 2,
      sent: 1,
      active: 0,
    });
  });
  test("a real zero is zeros", async () => {
    expect(await fetchCampaignStatusCounts("t")).toMatchObject({ all: 0 });
  });
  test("a read that fails is null, never zeros that would read as 'no campaigns'", async () => {
    failure = "timeout";
    expect(await fetchCampaignStatusCounts("t")).toBeNull();
  });
  test("an unknown channel is null too", async () => {
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    expect(await fetchCampaignStatusCounts("t", "sms" as never)).toBeNull();
    quiet.mockRestore();
  });
});
