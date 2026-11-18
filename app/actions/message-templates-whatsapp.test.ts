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
import { template } from "@/lib/campaigns/whatsapp-fixtures";

/**
 * Saving a message's WhatsApp row through the real action, with the role check
 * and the database replaced. What matters here is that the server refuses a
 * template the sender could never use, whatever the screen offered.
 */

const UUID = "3b7c1f6e-0d9a-4b52-8c1e-5a2f9d4e7b10";

let stored: unknown = null;
let upserts: unknown[] = [];

const real = {
  admin: { ...(await import("@/lib/insforge-admin")) },
  guard: { ...(await import("@/lib/auth-guard")) },
  cache: { ...(await import("next/cache")) },
};
let save: typeof import("./message-templates").saveMessageTemplate;

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
  mock.module("@/lib/insforge-admin", () => ({
    getAdminClient: () => {
      const made = chainDb(async (table, chain) => {
        if (table === "whatsapp_templates")
          return { data: stored, error: null };
        if (table === "message_templates") {
          if (has(chain, "upsert")) {
            upserts.push(argsOf(chain, "upsert")?.[0]);
            return { data: { id: "row-1" }, error: null };
          }
          return { data: null, error: null };
        }
        return { data: null, error: null };
      });
      return {
        database: {
          from: (table: string) => made.db.from(table),
        },
      };
    },
  }));
  ({ saveMessageTemplate: save } = await import("./message-templates"));
});

afterAll(() => {
  mock.module("next/cache", () => real.cache);
  mock.module("@/lib/auth-guard", () => real.guard);
  mock.module("@/lib/insforge-admin", () => real.admin);
});

beforeEach(() => {
  stored = null;
  upserts = [];
});

const input = {
  key: "booking_confirmed",
  channel: "whatsapp",
  locale: "es",
  enabled: true,
  whatsappTemplateId: UUID,
  whatsappParams: [{ kind: "field", field: "first_name" }],
};
const TEMPLATE = template({ id: UUID, param_count: 1, category: "UTILITY" });

describe("saveMessageTemplate — a WhatsApp row", () => {
  test("a template that can be sent is saved", async () => {
    stored = TEMPLATE;
    const out = await save("token", input);
    expect(out).toEqual({ ok: true, id: "row-1" });
    expect(upserts).toHaveLength(1);
  });

  test("a template with a button that needs a value is refused, on the template, and nothing is written", async () => {
    stored = {
      ...TEMPLATE,
      buttons: [{ type: "URL", text: "Ver", url: "https://example.com/{{1}}" }],
    };
    const out = await save("token", input);
    expect(out).toEqual({
      ok: false,
      error: "invalid",
      fieldErrors: { whatsappTemplateId: "templateButtonValue" },
    });
    expect(upserts).toHaveLength(0);
  });

  test("a button with a fixed address is fine", async () => {
    stored = {
      ...TEMPLATE,
      buttons: [{ type: "URL", text: "Web", url: "https://example.com/" }],
    };
    expect((await save("token", input)).ok).toBe(true);
  });

  test("a template that is not approved, or gone, keeps its own answer", async () => {
    stored = { ...TEMPLATE, status: "PENDING" };
    expect(await save("token", input)).toMatchObject({
      fieldErrors: { whatsappTemplateId: "templateUnavailable" },
    });
    stored = null;
    expect(await save("token", input)).toMatchObject({
      fieldErrors: { whatsappTemplateId: "templateUnavailable" },
    });
    expect(upserts).toHaveLength(0);
  });

  test("the reminder has no WhatsApp row any more: its notice is a campaign", async () => {
    stored = TEMPLATE;
    const out = await save("token", { ...input, key: "booking_reminder" });
    expect(out).toEqual({
      ok: false,
      error: "invalid",
      fieldErrors: { channel: "channelNotAllowed" },
    });
    expect(upserts).toHaveLength(0);
  });

  test("the switch is not part of a save: a text saved with `enabled` in it never writes it", async () => {
    stored = TEMPLATE;
    const out = await save("token", { ...input, enabled: false });
    expect(out.ok).toBe(true);
    expect(upserts).toHaveLength(1);
    expect(upserts[0]).not.toHaveProperty("enabled");
  });
});
