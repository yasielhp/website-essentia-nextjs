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
import { argsOf, chainDb, has, type Step } from "@/lib/campaigns/fake-db";

/**
 * The real WhatsApp webhook, signed as Meta signs it, with the database
 * replaced. What matters here: a STOP is remembered by NUMBER even when no
 * contact matches it, and no failure of that write (the table may not exist
 * yet) costs the rest of the payload or turns into a non-200.
 */

const SECRET = "test-app-secret";
let suppressionError: string | null = null;
let contacts: unknown[] = [];
let log: { table: string; chain: Step[] }[] = [];
/** What `record_campaign_event` answers: not one of a campaign's, by default. */
let rpcAnswer: { data: unknown; error: { message: string } | null };
let rpcCalls: { name: string; args: Record<string, unknown> }[] = [];
let bookingEventsError: string | null = null;

const real = { admin: { ...(await import("@/lib/insforge-admin")) } };
let POST: typeof import("./route").POST;

beforeAll(async () => {
  process.env.WHATSAPP_APP_SECRET = SECRET;
  mock.module("@/lib/insforge-admin", () => ({
    getAdminClient: () => {
      const made = chainDb(async (table, chain) => {
        if (table === "whatsapp_suppressed_phones") {
          return suppressionError
            ? { data: null, error: { message: suppressionError } }
            : { data: null, error: null };
        }
        if (table === "contacts" && !has(chain, "update")) {
          return { data: contacts, error: null };
        }
        if (table === "booking_events" && bookingEventsError) {
          return { data: null, error: { message: bookingEventsError } };
        }
        return { data: [], error: null };
      });
      // Share one log across the calls the handler makes.
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
});

beforeEach(() => {
  suppressionError = null;
  contacts = [];
  log = [];
  rpcAnswer = { data: false, error: null };
  rpcCalls = [];
  bookingEventsError = null;
});

function signed(body: unknown): NextRequest {
  const raw = JSON.stringify(body);
  const signature = crypto
    .createHmac("sha256", SECRET)
    .update(raw, "utf8")
    .digest("hex");
  return new NextRequest("https://app.example.test/api/webhooks/whatsapp", {
    method: "POST",
    body: raw,
    headers: { "x-hub-signature-256": `sha256=${signature}` },
  });
}

const inbound = (from: string, body: string) => ({
  entry: [
    {
      changes: [
        {
          field: "messages",
          value: { messages: [{ from, type: "text", text: { body } }] },
        },
      ],
    },
  ],
});

/** An inbound message of any type, as Meta delivers it. */
const inboundMessage = (message: Record<string, unknown>) => ({
  entry: [{ changes: [{ field: "messages", value: { messages: [message] } }] }],
});

const optOutUpdates = () =>
  log.filter(
    (q) =>
      q.table === "contacts" &&
      "whatsapp_opted_out_at" in
        ((argsOf(q.chain, "update")?.[0] as object | undefined) ?? {}),
  );

const suppressionWrites = () =>
  log.filter((q) => q.table === "whatsapp_suppressed_phones");

describe("STOP and the phone list", () => {
  test("a STOP from a number no contact has is still remembered", async () => {
    contacts = [];
    const res = await POST(signed(inbound("34600112233", "STOP")));
    expect(res.status).toBe(200);
    const writes = suppressionWrites();
    expect(writes).toHaveLength(1);
    expect(argsOf(writes[0]!.chain, "upsert")?.[0]).toEqual([
      { phone: "+34600112233", reason: "stop" },
    ]);
  });

  test("BAJA does the same, with the spaces and the accent people type", async () => {
    await POST(signed(inbound("34600112233", " Baja. ")));
    expect(suppressionWrites()).toHaveLength(1);
  });

  test("a message that is not a STOP writes nothing", async () => {
    await POST(signed(inbound("34600112233", "Hola, ¿a qué hora es mi cita?")));
    await POST(signed(inbound("34600112233", "cancelar")));
    expect(suppressionWrites()).toHaveLength(0);
  });

  test("a database error (the table does not exist yet) is logged, answers 200 and does not stop the contacts' opt-out", async () => {
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    suppressionError = 'relation "whatsapp_suppressed_phones" does not exist';
    contacts = [{ id: "c-1", phone: "600 11 22 33" }];
    const res = await POST(signed(inbound("34600112233", "STOP")));
    expect(res.status).toBe(200);
    expect(quiet).toHaveBeenCalled();
    quiet.mockRestore();
    // The matching contact was still found and unsubscribed.
    const updates = log.filter(
      (q) => q.table === "contacts" && has(q.chain, "update"),
    );
    expect(
      updates.some(
        (q) =>
          "whatsapp_opted_out_at" in
          ((argsOf(q.chain, "update")?.[0] as object) ?? {}),
      ),
    ).toBe(true);
  });

  test("the number is written before the contacts are read, so a failed read cannot lose it", async () => {
    await POST(signed(inbound("34600112233", "STOP")));
    const tables = log.map((q) => q.table);
    expect(tables.indexOf("whatsapp_suppressed_phones")).toBeLessThan(
      tables.indexOf("contacts"),
    );
  });

  test("an unsigned request is refused and writes nothing", async () => {
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(
      new NextRequest("https://app.example.test/api/webhooks/whatsapp", {
        method: "POST",
        body: JSON.stringify(inbound("34600112233", "STOP")),
      }),
    );
    quiet.mockRestore();
    expect(res.status).toBe(403);
    expect(suppressionWrites()).toHaveLength(0);
  });
});

describe("a STOP that is pressed, not typed", () => {
  const pressed: [string, Record<string, unknown>][] = [
    [
      "a template's quick-reply button (its label)",
      { type: "button", button: { text: "BAJA", payload: "optout" } },
    ],
    [
      "a template's quick-reply button (its payload)",
      { type: "button", button: { text: "No, gracias", payload: "STOP" } },
    ],
    [
      "an interactive reply button",
      {
        type: "interactive",
        interactive: {
          type: "button_reply",
          button_reply: { id: "1", title: "Stop" },
        },
      },
    ],
    [
      "an interactive list row",
      {
        type: "interactive",
        interactive: {
          type: "list_reply",
          list_reply: { id: "r-1", title: "Baja" },
        },
      },
    ],
  ];

  for (const [name, message] of pressed) {
    test(`${name} suppresses the number and opts the contact out`, async () => {
      contacts = [{ id: "c-1", phone: "600 11 22 33" }];
      const res = await POST(
        signed(inboundMessage({ from: "34600112233", ...message })),
      );
      expect(res.status).toBe(200);
      const writes = suppressionWrites();
      expect(writes).toHaveLength(1);
      expect(argsOf(writes[0]!.chain, "upsert")?.[0]).toEqual([
        { phone: "+34600112233", reason: "stop" },
      ]);
      const updates = optOutUpdates();
      expect(updates).toHaveLength(1);
      expect(argsOf(updates[0]!.chain, "in")).toEqual(["id", ["c-1"]]);
    });
  }

  test("a button that says something else is not a STOP", async () => {
    contacts = [{ id: "c-1", phone: "600 11 22 33" }];
    for (const message of [
      { type: "button", button: { text: "Cancelar", payload: "cancelar" } },
      { type: "button", button: { text: "Darme de baja", payload: "x" } },
      {
        type: "interactive",
        interactive: { button_reply: { id: "1", title: "Confirmar" } },
      },
    ]) {
      await POST(signed(inboundMessage({ from: "34600112233", ...message })));
    }
    expect(suppressionWrites()).toHaveLength(0);
    expect(optOutUpdates()).toHaveLength(0);
  });

  test("a pressed button still proves the number has WhatsApp: the unreachable mark is cleared", async () => {
    contacts = [{ id: "c-1", phone: "600 11 22 33" }];
    await POST(
      signed(
        inboundMessage({
          from: "34600112233",
          type: "button",
          button: { text: "Confirmar", payload: "ok" },
        }),
      ),
    );
    const cleared = log.filter(
      (q) =>
        q.table === "contacts" &&
        "whatsapp_unreachable_at" in
          ((argsOf(q.chain, "update")?.[0] as object | undefined) ?? {}),
    );
    expect(cleared).toHaveLength(1);
    expect(argsOf(cleared[0]!.chain, "update")?.[0]).toEqual({
      whatsapp_unreachable_at: null,
    });
  });
});

describe("the signature check", () => {
  const withSignature = (signature: string) =>
    new NextRequest("https://app.example.test/api/webhooks/whatsapp", {
      method: "POST",
      body: JSON.stringify(inbound("34600112233", "STOP")),
      headers: { "x-hub-signature-256": signature },
    });

  test("a signature of the right length in characters but not in bytes is a 403, not a crash", async () => {
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    // 64 characters, as a real digest has, but each one is two bytes in
    // UTF-8: `timingSafeEqual` throws on buffers of different sizes.
    // Latin-1 is what a header can carry.
    const res = await POST(withSignature(`sha256=${"\u00e9".repeat(64)}`));
    quiet.mockRestore();
    expect(res.status).toBe(403);
    expect(suppressionWrites()).toHaveLength(0);
  });

  test("a wrong signature of the right size is a 403", async () => {
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(withSignature(`sha256=${"0".repeat(64)}`));
    quiet.mockRestore();
    expect(res.status).toBe(403);
    expect(suppressionWrites()).toHaveLength(0);
  });
});

/** A payload of message states, as Meta delivers them. */
const states = (
  ...statuses: { id: string; status: string; timestamp?: string }[]
) => ({
  entry: [{ changes: [{ field: "messages", value: { statuses } }] }],
});

const bookingEventUpdates = () =>
  log.filter((q) => q.table === "booking_events" && has(q.chain, "update"));

// 2099-03-01T10:00:00Z and one minute later, in Meta's seconds.
const T_DELIVERED = "4076042400";
const T_READ = "4076042460";
const AT_READ = "2099-03-01T10:01:00.000Z";
const AT_DELIVERED = "2099-03-01T10:00:00.000Z";

describe("message states", () => {
  test("a state moves the booking's notice on, and nothing is logged", async () => {
    const loud = spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(
      signed(
        states({ id: "wamid.1", status: "delivered", timestamp: T_DELIVERED }),
      ),
    );
    const logged = loud.mock.calls.length;
    loud.mockRestore();
    expect(res.status).toBe(200);
    expect(logged).toBe(0);
    expect(rpcCalls.map((c) => c.args.p_event)).toEqual(["delivered"]);
    const updates = bookingEventUpdates();
    expect(updates).toHaveLength(1);
    expect(argsOf(updates[0]!.chain, "update")?.[0]).toEqual({
      status: "delivered",
      delivered_at: AT_DELIVERED,
    });
    expect(argsOf(updates[0]!.chain, "in")).toEqual(["status", ["sent"]]);
  });

  test("a state that belonged to a campaign does not touch the booking history", async () => {
    rpcAnswer = { data: true, error: null };
    await POST(signed(states({ id: "wamid.1", status: "read" })));
    expect(bookingEventUpdates()).toHaveLength(0);
  });

  test("a state the database refused is logged, not swallowed, and Meta is still answered 200", async () => {
    const loud = spyOn(console, "error").mockImplementation(() => {});
    bookingEventsError = "connection refused";
    const res = await POST(signed(states({ id: "wamid.1", status: "failed" })));
    const lines = loud.mock.calls.map((call) => String(call[0]));
    loud.mockRestore();
    expect(res.status).toBe(200);
    expect(lines.some((line) => line.includes("could not record status"))).toBe(
      true,
    );
  });

  test("one refused state does not cost the others of the payload", async () => {
    const loud = spyOn(console, "error").mockImplementation(() => {});
    bookingEventsError = "connection refused";
    const res = await POST(
      signed(
        states(
          { id: "wamid.1", status: "delivered" },
          { id: "wamid.2", status: "delivered" },
          { id: "wamid.3", status: "failed" },
        ),
      ),
    );
    const logged = loud.mock.calls.length;
    loud.mockRestore();
    expect(res.status).toBe(200);
    // Each one was attempted and each failure has its own line.
    expect(bookingEventUpdates()).toHaveLength(3);
    expect(logged).toBe(3);
  });

  test("a campaign receipt the database refused is logged and the booking history is still tried", async () => {
    const loud = spyOn(console, "error").mockImplementation(() => {});
    rpcAnswer = { data: null, error: { message: "connection refused" } };
    const res = await POST(
      signed(states({ id: "wamid.1", status: "delivered" })),
    );
    const logged = loud.mock.calls.length;
    loud.mockRestore();
    expect(res.status).toBe(200);
    expect(logged).toBe(1);
    expect(bookingEventUpdates()).toHaveLength(1);
  });
});

describe("a read and the hour of delivery", () => {
  test("a read does not rewrite a delivery already stamped: it only fills an empty one", async () => {
    const res = await POST(
      signed(states({ id: "wamid.1", status: "read", timestamp: T_READ })),
    );
    expect(res.status).toBe(200);
    const updates = bookingEventUpdates();
    expect(updates).toHaveLength(2);

    // First the hour of delivery, and only where there is none.
    const [fill, move] = updates;
    expect(argsOf(fill!.chain, "update")?.[0]).toEqual({
      delivered_at: AT_READ,
    });
    expect(argsOf(fill!.chain, "is")).toEqual(["delivered_at", null]);
    expect(argsOf(fill!.chain, "eq")).toEqual(["provider_id", "wamid.1"]);
    expect(argsOf(fill!.chain, "in")).toEqual([
      "status",
      ["sent", "delivered"],
    ]);

    // Then the state, which no longer carries `delivered_at` at all.
    expect(argsOf(move!.chain, "update")?.[0]).toEqual({
      status: "read",
      read_at: AT_READ,
    });
    expect(has(move!.chain, "is")).toBe(false);
    expect(argsOf(move!.chain, "in")).toEqual([
      "status",
      ["sent", "delivered"],
    ]);
  });

  test("a delivery and a failure are one write each, as before", async () => {
    await POST(
      signed(
        states(
          { id: "wamid.1", status: "delivered", timestamp: T_DELIVERED },
          { id: "wamid.2", status: "failed", timestamp: T_READ },
        ),
      ),
    );
    const updates = bookingEventUpdates();
    expect(updates).toHaveLength(2);
    expect(updates.some((q) => has(q.chain, "is"))).toBe(false);
  });

  test("an hour of delivery that could not be filled is logged and the read is still recorded", async () => {
    const loud = spyOn(console, "error").mockImplementation(() => {});
    bookingEventsError = "connection refused";
    const res = await POST(
      signed(states({ id: "wamid.1", status: "read", timestamp: T_READ })),
    );
    const logged = loud.mock.calls.length;
    loud.mockRestore();
    expect(res.status).toBe(200);
    expect(bookingEventUpdates()).toHaveLength(2);
    expect(logged).toBe(1);
  });
});
