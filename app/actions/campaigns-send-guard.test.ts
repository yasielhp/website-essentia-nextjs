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
/** The language condition of the saved campaign's audience. */
let language: "any" | "es" | "en" = "any";
/** Which versions the saved campaign has written. */
let written: ("es" | "en")[] = ["es", "en"];
/** A version written in full whose subject is longer than the limit. */
let tooLong: ("es" | "en")[] = [];
let readError = false;
let missing = false;
let dispatched: string[] = [];
let updates: unknown[] = [];

const EMPTY = { subject: "", preheader: "", title: "", doc: null };
const version = (hello: string) => ({
  subject: hello,
  // An A/B test (`split` is one of the one-off kinds below) has two.
  subjectB: `${hello} B`,
  preheader: "",
  title: hello,
  doc: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: hello }] }],
  },
});
/** The campaign as the database holds it: what the actions read back. */
const saved = () => ({
  name: "Reapertura",
  channel: "email",
  kind,
  trigger: {},
  audience: {
    language,
    newsletter: null,
    services: [],
    lastBooking: null,
    neverBooked: false,
    manualIds: [],
  },
  content: {
    es: written.includes("es")
      ? version(tooLong.includes("es") ? "H".repeat(121) : "Hola")
      : EMPTY,
    en: written.includes("en")
      ? version(tooLong.includes("en") ? "H".repeat(121) : "Hello")
      : EMPTY,
  },
});

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
        return { data: missing ? null : saved(), error: null };
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
  language = "any";
  written = ["es", "en"];
  tooLong = [];
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

describe("nothing goes out with a language of its audience missing", () => {
  test("an audience of both languages with only the Spanish version is not sent, and the refusal says English is missing", async () => {
    written = ["es"];
    expect(await sendCampaignNow("t", "camp-1")).toEqual({
      ok: false,
      error: "missing_en",
    });
    expect(dispatched).toEqual([]);
  });

  test("nor scheduled", async () => {
    written = ["en"];
    expect(await scheduleCampaign("t", "camp-1", FUTURE)).toEqual({
      ok: false,
      error: "missing_es",
    });
    expect(updates).toEqual([]);
  });

  test("with neither version the refusal names both", async () => {
    written = [];
    expect(await sendCampaignNow("t", "camp-1")).toEqual({
      ok: false,
      error: "missing_both",
    });
    expect(await scheduleCampaign("t", "camp-1", FUTURE)).toEqual({
      ok: false,
      error: "missing_both",
    });
  });

  test("a Spanish audience needs only the Spanish version, to be sent or scheduled", async () => {
    language = "es";
    written = ["es"];
    expect(await sendCampaignNow("t", "camp-1")).toMatchObject({ ok: true });
    expect(await scheduleCampaign("t", "camp-1", FUTURE)).toEqual({
      ok: true,
    });
  });

  test("and an English one only the English", async () => {
    language = "en";
    written = ["en"];
    expect(await sendCampaignNow("t", "camp-1")).toMatchObject({ ok: true });
    language = "en";
    written = ["es"];
    dispatched = [];
    expect(await sendCampaignNow("t", "camp-1")).toEqual({
      ok: false,
      error: "missing_en",
    });
    expect(dispatched).toEqual([]);
  });
});

describe("a version written in full but wrong is not called missing", () => {
  test("an English subject past the limit: the refusal says the English version has errors", async () => {
    written = ["es", "en"];
    tooLong = ["en"];
    expect(await sendCampaignNow("t", "camp-1")).toEqual({
      ok: false,
      error: "errors_en",
    });
    expect(dispatched).toEqual([]);
  });

  test("Spanish missing and English wrong: it says both", async () => {
    written = ["en"];
    tooLong = ["en"];
    expect(await scheduleCampaign("t", "camp-1", FUTURE)).toEqual({
      ok: false,
      error: "missing_es_errors_en",
    });
    expect(updates).toEqual([]);
  });
});
