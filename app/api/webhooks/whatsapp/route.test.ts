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
