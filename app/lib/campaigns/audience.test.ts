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
import { EMPTY_AUDIENCE } from "@/types/campaign";
import { chainDb } from "./fake-db";

/**
 * `resolveAudience` over a replaced database. What matters here is the STOP
 * list: a WhatsApp audience leaves out the numbers on it, one that cannot be
 * read (its table is created by a migration) makes the audience impossible to
 * resolve rather than unfiltered, and email never reads it.
 */

const CONTACT = {
  id: "c-1",
  email: "ana@example.test",
  first_name: "Ana",
  last_name: null,
  phone: "600 11 22 33",
  preferred_language: "es",
  newsletter_subscribed: true,
  email_bounced_at: null,
  newsletter_unsubscribed_at: null,
  newsletter_subscribed_at: null,
  birthdate: null,
  whatsapp_marketing_opted_in_at: "2026-11-01T00:00:00Z" as string | null,
  whatsapp_opted_in_at: null as string | null,
  whatsapp_opted_out_at: null,
  whatsapp_unreachable_at: null,
};

const BOOKING = {
  id: "b-1",
  contact_id: "c-1",
  email: "ana@example.test",
  service_id: "svc-1",
  service_title: "Drenaje linfático",
  tier_id: null,
  date: "2026-12-11",
  time: "09:00",
  duration: "60 min",
  status: "confirmed",
};

let suppressed: string[] = [];
let suppressedError: string | null = null;
let tablesRead: string[] = [];
let contact: typeof CONTACT = CONTACT;
let bookings: (typeof BOOKING)[] = [];
let selects: Record<string, string> = {};

const real = { admin: { ...(await import("@/lib/insforge-admin")) } };
let resolveAudience: typeof import("./audience").resolveAudience;

beforeAll(async () => {
  mock.module("@/lib/insforge-admin", () => ({
    getAdminClient: () => ({
      database: chainDb(async (table, chain) => {
        tablesRead.push(table);
        const select = chain.find((step) => step.name === "select");
        if (select) selects[table] = String(select.args[0]);
        if (table === "contacts") return { data: [contact], error: null };
        if (table === "bookings") return { data: bookings, error: null };
        if (table === "whatsapp_suppressed_phones") {
          return suppressedError
            ? { data: null, error: { message: suppressedError } }
            : { data: suppressed.map((phone) => ({ phone })), error: null };
        }
        return { data: [], error: null };
      }).db,
    }),
  }));
  ({ resolveAudience } = await import("./audience"));
});

afterAll(() => {
  mock.module("@/lib/insforge-admin", () => real.admin);
});

beforeEach(() => {
  suppressed = [];
  suppressedError = null;
  tablesRead = [];
  contact = CONTACT;
  bookings = [];
  selects = {};
});

const EVERYONE = EMPTY_AUDIENCE;
const NOW = new Date("2026-11-17T12:00:00Z");

describe("resolveAudience and the STOP list", () => {
  test("a WhatsApp audience leaves out a number on the list", async () => {
    suppressed = ["+34600112233"];
    expect(await resolveAudience(EVERYONE, NOW, "whatsapp")).toEqual([]);
  });

  test("and keeps it when the list does not have it", async () => {
    suppressed = ["+34999999999"];
    const out = await resolveAudience(EVERYONE, NOW, "whatsapp");
    expect(out.map((r) => r.phone)).toEqual(["+34600112233"]);
  });

  test("a list that cannot be read makes the audience fail, never unfiltered", async () => {
    suppressedError = 'relation "whatsapp_suppressed_phones" does not exist';
    await expect(resolveAudience(EVERYONE, NOW, "whatsapp")).rejects.toThrow(
      "does not exist",
    );
  });

  test("email never reads the list, so it works whether the table exists or not", async () => {
    suppressedError = "no table";
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    const out = await resolveAudience(EVERYONE, NOW, "email");
    quiet.mockRestore();
    expect(out.map((r) => r.email)).toEqual(["ana@example.test"]);
    expect(tablesRead).not.toContain("whatsapp_suppressed_phones");
    const byDefault = await resolveAudience(EVERYONE, NOW);
    expect(byDefault).toHaveLength(1);
    expect(tablesRead).not.toContain("whatsapp_suppressed_phones");
  });
});

describe("resolveAudience for an appointment notice", () => {
  const NOTICES_ONLY = {
    ...CONTACT,
    whatsapp_marketing_opted_in_at: null,
    whatsapp_opted_in_at: "2026-11-01T00:00:00Z" as string | null,
  };
  const appointment = { purpose: "appointment" as const, appointments: true };

  test("reaches the client who agreed to appointment notices, though not to news", async () => {
    contact = NOTICES_ONLY;
    const out = await resolveAudience(EVERYONE, NOW, "whatsapp", appointment);
    expect(out.map((r) => r.phone)).toEqual(["+34600112233"]);
  });

  test("and leaves out the one who agreed to news only", async () => {
    contact = { ...CONTACT, whatsapp_opted_in_at: null };
    expect(
      await resolveAudience(EVERYONE, NOW, "whatsapp", appointment),
    ).toEqual([]);
  });

  test("a campaign of news is the other way round", async () => {
    contact = NOTICES_ONLY;
    expect(await resolveAudience(EVERYONE, NOW, "whatsapp")).toEqual([]);
    contact = { ...CONTACT, whatsapp_opted_in_at: null };
    expect(await resolveAudience(EVERYONE, NOW, "whatsapp")).toHaveLength(1);
  });

  test("the recipient carries her appointments, from the bookings that count", async () => {
    contact = NOTICES_ONLY;
    bookings = [
      BOOKING,
      { ...BOOKING, id: "b-2", status: "completed", date: "2026-12-12" },
      { ...BOOKING, id: "b-3", status: "pending" },
    ];
    const [out] = await resolveAudience(EVERYONE, NOW, "whatsapp", appointment);
    expect(out?.appointments?.map((a) => a.id)).toEqual(["b-1", "b-2"]);
    expect(out?.appointments?.[0]).toMatchObject({
      serviceId: "svc-1",
      startsAt: "2026-12-11T09:00:00.000Z",
    });
  });

  test("a client with no bookings has an empty list, not none", async () => {
    contact = NOTICES_ONLY;
    const [out] = await resolveAudience(EVERYONE, NOW, "whatsapp", appointment);
    expect(out?.appointments).toEqual([]);
  });

  test("appointments are loaded only when asked for: nothing else pays for them", async () => {
    bookings = [BOOKING];
    const marketing = await resolveAudience(EVERYONE, NOW, "whatsapp");
    expect(marketing[0]).not.toHaveProperty("appointments");
    const email = await resolveAudience(EVERYONE, NOW, "email");
    expect(email[0]).not.toHaveProperty("appointments");
  });

  test("still never reaches a number that said STOP", async () => {
    contact = NOTICES_ONLY;
    suppressed = ["+34600112233"];
    expect(
      await resolveAudience(EVERYONE, NOW, "whatsapp", appointment),
    ).toEqual([]);
  });

  test("the contacts read asks for the appointment consent", async () => {
    await resolveAudience(EVERYONE, NOW, "whatsapp", appointment);
    expect(selects.contacts).toContain("whatsapp_opted_in_at");
  });

  test("email is the same with or without the options", async () => {
    bookings = [BOOKING];
    const base = await resolveAudience(EVERYONE, NOW, "email");
    const withOptions = await resolveAudience(EVERYONE, NOW, "email", {
      purpose: "appointment",
    });
    expect(withOptions).toEqual(base);
  });
});
