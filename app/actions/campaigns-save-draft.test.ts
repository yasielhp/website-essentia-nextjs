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

/**
 * `saveCampaign` as a "draft": loose for a campaign that is going nowhere, in
 * full for one that is live (it goes out as saved), and never a guess.
 */
const audience = {
  language: "any" as const,
  newsletter: null,
  services: [],
  lastBooking: null,
  neverBooked: false,
  sendLocale: "es" as const,
  manualIds: [],
};
const empty = { subject: "", preheader: "", title: "", doc: null };
const input = (over: Record<string, unknown> = {}) => ({
  name: "Reapertura",
  channel: "email" as const,
  kind: "standard" as const,
  trigger: {},
  audience,
  content: { en: empty, es: empty },
  ...over,
});

let status: string | null = "active";
let statusError: string | null = null;
let writes: string[] = [];

const real = {
  guard: { ...(await import("@/lib/auth-guard")) },
  admin: { ...(await import("@/lib/insforge-admin")) },
  cache: { ...(await import("next/cache")) },
};
let saveCampaign: typeof import("./campaigns").saveCampaign;

beforeAll(async () => {
  mock.module("@/lib/auth-guard", () => ({
    ...real.guard,
    requireRole: async () => ({
      userId: "admin-1",
      email: "a@e.test",
      role: "admin",
    }),
  }));
  // Outside a request there is no cache to revalidate.
  mock.module("next/cache", () => ({
    ...real.cache,
    revalidatePath: () => {},
  }));
  mock.module("@/lib/insforge-admin", () => ({
    getAdminClient: () => ({
      database: chainDb(async (table, chain) => {
        const names = chain.map((s) => s.name);
        if (names.includes("update") || names.includes("insert")) {
          writes.push(`${table}:${names[0]}`);
          return { data: [{ id: "c-1" }], error: null };
        }
        if (table === "campaigns" && names.includes("maybeSingle")) {
          return statusError
            ? { data: null, error: { message: statusError } }
            : {
                data: status
                  ? { status, channel: "email", kind: "standard" }
                  : null,
                error: null,
              };
        }
        return { data: [], error: null };
      }).db,
    }),
  }));
  ({ saveCampaign } = await import("./campaigns"));
});

afterAll(() => {
  mock.module("@/lib/auth-guard", () => real.guard);
  mock.module("@/lib/insforge-admin", () => real.admin);
  mock.module("next/cache", () => real.cache);
});

beforeEach(() => {
  status = "active";
  statusError = null;
  writes = [];
});

describe("saveCampaign as a draft", () => {
  test("a new draft with no name is simply invalid, never a request to pause", async () => {
    const out = await saveCampaign("t", input({ name: "" }), { draft: true });
    expect(out).toMatchObject({ ok: false, error: "invalid" });
    expect(writes).toEqual([]);
  });

  test("an incomplete draft of a campaign that is a draft is saved", async () => {
    status = "draft";
    const out = await saveCampaign("t", input({ id: "c-1" }), { draft: true });
    expect(out).toMatchObject({ ok: true });
    expect(writes).toEqual(["campaigns:update"]);
  });

  test("an incomplete 'draft' of an ACTIVE campaign asks for a pause and writes nothing", async () => {
    const out = await saveCampaign("t", input({ id: "c-1" }), { draft: true });
    expect(out).toMatchObject({ ok: false, error: "pause_to_save" });
    expect(writes).toEqual([]);
  });

  test("the same for a scheduled one", async () => {
    status = "scheduled";
    const out = await saveCampaign("t", input({ id: "c-1" }), { draft: true });
    expect(out).toMatchObject({ ok: false, error: "pause_to_save" });
  });

  test("if the state cannot be read it is a failure, not a loose save of what may be live", async () => {
    statusError = "timeout";
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    const out = await saveCampaign("t", input({ id: "c-1" }), { draft: true });
    quiet.mockRestore();
    expect(out).toEqual({ ok: false, error: "db" });
    expect(writes).toEqual([]);
  });
});
