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
// When set, the tables behave like the real ones: pages of at most a thousand rows.
let bigContacts: (typeof CONTACT)[] | null = null;
let bookingPageError: number | null = null;
let bookingReads = 0;
let selects: Record<string, string> = {};
let chains: Record<string, string[]> = {};
let bookingArgs: Record<string, unknown[]> = {};

const real = { admin: { ...(await import("@/lib/insforge-admin")) } };
let resolveAudience: typeof import("./audience").resolveAudience;

beforeAll(async () => {
  mock.module("@/lib/insforge-admin", () => ({
    getAdminClient: () => ({
      database: chainDb(async (table, chain) => {
        tablesRead.push(table);
        const select = chain.find((step) => step.name === "select");
        if (select) selects[table] = String(select.args[0]);
        chains[table] = chain.map((step) => step.name);
        for (const step of chain) {
          if (table === "bookings") bookingArgs[step.name] = step.args;
        }
        const range = chain.find((step) => step.name === "range")?.args as
          [number, number] | undefined;
        if (table === "contacts") {
          // The whole table: `chainDb` cuts it to the range, as the database does.
          return { data: bigContacts ?? [contact], error: null };
        }
        if (table === "bookings") {
          bookingReads++;
          if (bookingPageError !== null && range?.[0] === bookingPageError) {
            return { data: null, error: { message: "timeout" } };
          }
          return { data: bookings, error: null };
        }
        if (table === "whatsapp_suppressed_phones") {
          return suppressedError
            ? { data: null, error: { message: suppressedError } }
            : {
                data: suppressed.map((phone) => ({ phone })),
                error: null,
              };
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
  bigContacts = null;
  bookingPageError = null;
  bookingReads = 0;
  selects = {};
  chains = {};
  bookingArgs = {};
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

describe("resolveAudience for an email campaign: subscribers only", () => {
  const row = (n: number, over: Partial<typeof CONTACT> = {}) => ({
    ...CONTACT,
    id: `c-${n}`,
    email: `person${n}@example.test`,
    phone: null as unknown as string,
    ...over,
  });
  const people = () => [
    row(1),
    row(2, { newsletter_subscribed: false }),
    // Never answered: the column is null, not false.
    row(3, { newsletter_subscribed: null as unknown as boolean }),
    row(4, {
      newsletter_subscribed: false,
      newsletter_unsubscribed_at: "2026-10-01T00:00:00Z" as unknown as null,
    }),
    row(5, { email_bounced_at: "2026-10-01T00:00:00Z" as unknown as null }),
  ];

  test("the stored contacts: only the subscribed one with a working address and no unsubscribe", async () => {
    bigContacts = people();
    const out = await resolveAudience(EVERYONE, NOW, "email");
    expect(out.map((r) => r.id)).toEqual(["c-1"]);
  });

  test("picked by hand, or as a hand-made list, the others are still left out", async () => {
    bigContacts = people();
    const all = people().map((p) => p.id);
    const picked = await resolveAudience(
      { ...EVERYONE, manualIds: all },
      NOW,
      "email",
    );
    const list = await resolveAudience(
      { ...EVERYONE, manualIds: all, manualOnly: true },
      NOW,
      "email",
    );
    expect(picked.map((r) => r.id)).toEqual(["c-1"]);
    expect(list.map((r) => r.id)).toEqual(["c-1"]);
  });

  test("the same people on WhatsApp are judged on their WhatsApp consent, not the newsletter", async () => {
    bigContacts = people().map((p, i) => ({
      ...p,
      phone: `600 11 22 3${i}`,
    }));
    const out = await resolveAudience(EVERYONE, NOW, "whatsapp");
    expect(out.map((r) => r.id)).toEqual(["c-1", "c-2", "c-3", "c-4", "c-5"]);
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

describe("the bookings an appointment notice reads", () => {
  const appointment = { purpose: "appointment" as const, appointments: true };

  test("every other resolution reads them exactly as it always did", async () => {
    await resolveAudience(EVERYONE, NOW, "whatsapp");
    expect(chains.bookings).toEqual(["select", "neq", "order", "range"]);
    chains = {};
    await resolveAudience(EVERYONE, NOW, "email");
    expect(chains.bookings).toEqual(["select", "neq", "order", "range"]);
    chains = {};
    await resolveAudience(EVERYONE, NOW, "whatsapp", {
      purpose: "appointment",
    });
    expect(chains.bookings).toEqual(["select", "neq", "order", "range"]);
  });

  test("an appointment notice reads only the last 31 days and what is ahead, in a fixed order", async () => {
    await resolveAudience(EVERYONE, NOW, "whatsapp", appointment);
    expect(chains.bookings).toEqual([
      "select",
      "neq",
      "gte",
      "order",
      "order",
      "range",
    ]);
    // 31 days before 2026-11-17.
    expect(bookingArgs.gte).toEqual(["date", "2026-10-17"]);
  });

  test("31 days is the longest notice (720 hours, 30 days) and the bound on it", async () => {
    // after_visit can look back 30 days and 3 hours; 31 covers it.
    await resolveAudience(
      EVERYONE,
      new Date("2026-03-01T00:30:00Z"),
      "whatsapp",
      appointment,
    );
    expect(bookingArgs.gte).toEqual(["date", "2026-01-29"]);
  });

  test("the contacts are read the same way in both", async () => {
    await resolveAudience(EVERYONE, NOW, "whatsapp");
    const plain = chains.contacts;
    chains = {};
    await resolveAudience(EVERYONE, NOW, "whatsapp", appointment);
    expect(chains.contacts).toEqual(plain);
  });
});

describe("a table longer than a page", () => {
  const N = 2_500;
  const people = Array.from({ length: N }, (_, i) => ({
    ...CONTACT,
    id: `c-${i}`,
    email: `p${i}@example.test`,
    phone: `+3460${String(1_000_000 + i)}`,
  }));
  const booked = people.map((p, i) => ({
    ...BOOKING,
    id: `b-${i}`,
    contact_id: p.id,
    email: p.email,
  }));

  test("every contact is read, not the first thousand", async () => {
    bigContacts = people;
    const out = await resolveAudience(EVERYONE, NOW, "email");
    expect(out).toHaveLength(N);
  });

  test("and every booking: a client with one is not 'never booked' because hers is on page three", async () => {
    bigContacts = people;
    bookings = booked;
    const out = await resolveAudience(
      { ...EVERYONE, hasBooked: true },
      NOW,
      "email",
    );
    expect(out).toHaveLength(N);
    // Three pages of rows and the empty one that says the table ended.
    expect(bookingReads).toBe(4);
  });

  test("a page of bookings that fails fails the whole read, with no partial audience", async () => {
    bigContacts = people;
    bookings = booked;
    bookingPageError = 1_000;
    await expect(resolveAudience(EVERYONE, NOW, "email")).rejects.toThrow(
      "[resolveAudience] bookings read failed: timeout",
    );
  });

  test("the pages of an appointment notice are in the same total order", async () => {
    bigContacts = people;
    bookings = booked;
    await resolveAudience(EVERYONE, NOW, "email", {
      appointments: true,
    });
    expect(chains.bookings).toEqual([
      "select",
      "neq",
      "gte",
      "order",
      "order",
      "range",
    ]);
  });
});
