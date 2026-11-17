import crypto from "node:crypto";
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
import {
  argsOf,
  chainDb,
  filters,
  has,
  type Step,
} from "@/lib/campaigns/fake-db";

/**
 * The real Resend webhook, signed as Resend (Svix) signs it and checked by the
 * SDK's own verifier, with the database replaced. What matters here: a write
 * the database refused is not acknowledged, so Resend sends the event again.
 *
 * The module is put back afterwards: `mock.module` is process-wide.
 */

const SECRET_BYTES = crypto.randomBytes(24);
const SECRET = `whsec_${SECRET_BYTES.toString("base64")}`;

type RpcCall = { name: string; args: Record<string, unknown> };

let rpcAnswer: { data: unknown; error: { message: string } | null };
let updateError: string | null = null;
let rpcCalls: RpcCall[] = [];
let log: { table: string; chain: Step[] }[] = [];

const real = { admin: { ...(await import("@/lib/insforge-admin")) } };
const env = {
  secret: process.env.RESEND_WEBHOOK_SECRET,
  key: process.env.RESEND_API_KEY,
};
let POST: typeof import("./route").POST;

beforeAll(async () => {
  process.env.RESEND_WEBHOOK_SECRET = SECRET;
  // The SDK refuses to be built without a key; nothing is ever sent with it.
  process.env.RESEND_API_KEY = "re_test_key";
  mock.module("@/lib/insforge-admin", () => ({
    getAdminClient: () => {
      const made = chainDb(async () =>
        updateError
          ? { data: null, error: { message: updateError } }
          : { data: [], error: null },
      );
      return {
        database: {
          from: (table: string) => {
            const builder = made.db.from(table);
            log = made.log;
            return builder;
          },
          rpc: async (name: string, args: Record<string, unknown>) => {
            rpcCalls.push({ name, args });
            return rpcAnswer;
          },
        },
      };
    },
  }));
  ({ POST } = await import("./route"));
});

afterAll(() => {
  mock.module("@/lib/insforge-admin", () => real.admin);
  if (env.secret === undefined) delete process.env.RESEND_WEBHOOK_SECRET;
  else process.env.RESEND_WEBHOOK_SECRET = env.secret;
  if (env.key === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = env.key;
});

beforeEach(() => {
  rpcAnswer = { data: true, error: null };
  updateError = null;
  rpcCalls = [];
  log = [];
});

function signed(event: unknown): NextRequest {
  const raw = JSON.stringify(event);
  const id = `msg_${crypto.randomUUID()}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = crypto
    .createHmac("sha256", SECRET_BYTES)
    .update(`${id}.${timestamp}.${raw}`)
    .digest("base64");
  return new NextRequest("https://app.example.test/api/webhooks/resend", {
    method: "POST",
    body: raw,
    headers: {
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": `v1,${signature}`,
    },
  });
}

const AT = "2099-03-01T10:00:00.000Z";

const campaignEvent = (type: string) => ({
  type,
  created_at: AT,
  data: {
    email_id: "em-1",
    tags: { campaign_id: "camp-1" },
    bounce: { message: "Mailbox does not exist" },
  },
});

const bookingEvent = (type: string) => ({
  type,
  created_at: AT,
  data: { email_id: "em-2" },
});

const bookingUpdates = () =>
  log.filter((q) => q.table === "booking_events" && has(q.chain, "update"));

describe("the signature", () => {
  test("a body signed with our secret is taken", async () => {
    const res = await POST(signed(bookingEvent("email.delivered")));
    expect(res.status).toBe(200);
  });

  test("a body signed with another secret is a 403 and writes nothing", async () => {
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    const req = signed(campaignEvent("email.bounced"));
    req.headers.set("svix-signature", `v1,${"A".repeat(43)}=`);
    const res = await POST(req);
    quiet.mockRestore();
    expect(res.status).toBe(403);
    expect(rpcCalls).toHaveLength(0);
    expect(log).toHaveLength(0);
  });
});

describe("a campaign email's event", () => {
  test("goes to record_campaign_event and is acknowledged", async () => {
    const res = await POST(signed(campaignEvent("email.bounced")));
    expect(res.status).toBe(200);
    expect(rpcCalls).toEqual([
      {
        name: "record_campaign_event",
        args: {
          p_provider_id: "em-1",
          p_event: "bounced",
          p_at: AT,
          p_error: "Mailbox does not exist",
        },
      },
    ]);
    expect(log).toHaveLength(0);
  });

  test("a recipient that did not move (unknown, repeated) is still acknowledged", async () => {
    rpcAnswer = { data: false, error: null };
    const res = await POST(signed(campaignEvent("email.delivered")));
    expect(res.status).toBe(200);
  });

  test("a bounce the database could not record is logged and NOT acknowledged, so Resend retries", async () => {
    const loud = spyOn(console, "error").mockImplementation(() => {});
    rpcAnswer = { data: null, error: { message: "connection refused" } };
    const res = await POST(signed(campaignEvent("email.bounced")));
    const logged = loud.mock.calls.length;
    loud.mockRestore();
    expect(res.status).toBe(503);
    expect(logged).toBeGreaterThan(0);
  });

  test("an event this log has no use for is acknowledged without a write", async () => {
    const res = await POST(signed(campaignEvent("email.sent")));
    expect(res.status).toBe(200);
    expect(rpcCalls).toHaveLength(0);
  });
});

describe("a booking email's event", () => {
  test("moves the row on from the states that precede it", async () => {
    const res = await POST(signed(bookingEvent("email.delivered")));
    expect(res.status).toBe(200);
    const updates = bookingUpdates();
    expect(updates).toHaveLength(1);
    expect(argsOf(updates[0]!.chain, "update")?.[0]).toEqual({
      status: "delivered",
      delivered_at: AT,
    });
    expect(argsOf(updates[0]!.chain, "in")).toEqual(["status", ["sent"]]);
    expect(rpcCalls).toHaveLength(0);
  });

  test("a status the database could not record is logged and NOT acknowledged, so Resend retries", async () => {
    const loud = spyOn(console, "error").mockImplementation(() => {});
    updateError = "connection refused";
    const res = await POST(signed(bookingEvent("email.bounced")));
    const logged = loud.mock.calls.length;
    loud.mockRestore();
    expect(res.status).toBe(503);
    expect(logged).toBeGreaterThan(0);
  });

  test("an event this log has no use for is acknowledged without a write", async () => {
    const res = await POST(signed(bookingEvent("email.delivery_delayed")));
    expect(res.status).toBe(200);
    expect(log).toHaveLength(0);
  });
});

describe("an open and the hour of delivery", () => {
  test("an open does not rewrite a delivery already stamped: it only fills an empty one", async () => {
    const res = await POST(signed(bookingEvent("email.opened")));
    expect(res.status).toBe(200);
    const updates = bookingUpdates();
    expect(updates).toHaveLength(2);

    // First the hour of delivery, and only where there is none.
    const [fill, move] = updates;
    expect(argsOf(fill!.chain, "update")?.[0]).toEqual({ delivered_at: AT });
    expect(argsOf(fill!.chain, "is")).toEqual(["delivered_at", null]);
    expect(filters(fill!.chain)).toEqual({
      provider_id: "em-2",
      channel: "email",
    });
    expect(argsOf(fill!.chain, "in")).toEqual([
      "status",
      ["sent", "delivered"],
    ]);

    // Then the state, which no longer carries `delivered_at` at all.
    expect(argsOf(move!.chain, "update")?.[0]).toEqual({
      status: "read",
      read_at: AT,
    });
    expect(has(move!.chain, "is")).toBe(false);
    expect(filters(move!.chain)).toEqual({
      provider_id: "em-2",
      channel: "email",
    });
  });

  test("a bounce is one write, as before", async () => {
    await POST(signed(bookingEvent("email.bounced")));
    const updates = bookingUpdates();
    expect(updates).toHaveLength(1);
    expect(argsOf(updates[0]!.chain, "update")?.[0]).toEqual({
      status: "failed",
      error: "Rebotado",
    });
  });

  test("an open the database refused is not acknowledged, and the state was still tried", async () => {
    const loud = spyOn(console, "error").mockImplementation(() => {});
    updateError = "connection refused";
    const res = await POST(signed(bookingEvent("email.opened")));
    loud.mockRestore();
    expect(res.status).toBe(503);
    expect(bookingUpdates()).toHaveLength(2);
  });
});
