import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { NextRequest } from "next/server";
import type { SyncTemplatesResult } from "@/lib/whatsapp/sync-templates";

// The route is run for real; only the sync it calls is replaced, and the real
// module is put back at the end (`mock.module` is process-wide).
const realSync = { ...(await import("@/lib/whatsapp/sync-templates")) };

let answer: SyncTemplatesResult = { ok: true, count: 0, skipped: 0 };
let calls = 0;
mock.module("@/lib/whatsapp/sync-templates", () => ({
  ...realSync,
  syncTemplatesFromMeta: async () => {
    calls += 1;
    return answer;
  },
}));
afterAll(() => {
  mock.module("@/lib/whatsapp/sync-templates", () => realSync);
});

const { GET, POST } = await import("./route");

const SECRET = "cron-secret-for-tests";
const request = (authorization?: string) =>
  new NextRequest("https://example.test/api/cron/whatsapp-templates", {
    headers: authorization ? { authorization } : {},
  });

describe("the hourly sync of the WhatsApp templates", () => {
  const previous = process.env.CRON_SECRET;
  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
    answer = { ok: true, count: 0, skipped: 0 };
    calls = 0;
  });
  afterAll(() => {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  });

  test("refuses to run with no secret set, and asks Meta nothing", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(request(`Bearer ${SECRET}`));
    expect(res.status).toBe(503);
    expect(calls).toBe(0);
  });
  test("refuses a caller without the secret, and asks Meta nothing", async () => {
    expect((await GET(request())).status).toBe(403);
    expect((await GET(request("Bearer wrong"))).status).toBe(403);
    expect(calls).toBe(0);
  });
  test("with the secret it syncs once and says how many it wrote and skipped", async () => {
    answer = { ok: true, count: 4, skipped: 1 };
    const res = await POST(request(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, synced: 4, skipped: 1 });
    expect(calls).toBe(1);
  });
  test("an account that is not configured is not an error: there is nothing to ask", async () => {
    answer = { ok: false, error: "whatsapp_not_configured" };
    const res = await GET(request(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, skipped: "not_configured" });
  });
  test("a failure of Meta or of the database is a 500 that names it, without what Meta said", async () => {
    answer = { ok: false, error: "meta", detail: "(#190) token expired" };
    const meta = await GET(request(`Bearer ${SECRET}`));
    expect(meta.status).toBe(500);
    expect(await meta.json()).toEqual({ error: "meta" });
    answer = { ok: false, error: "db" };
    const db = await GET(request(`Bearer ${SECRET}`));
    expect(db.status).toBe(500);
    expect(await db.json()).toEqual({ error: "db" });
  });
});
