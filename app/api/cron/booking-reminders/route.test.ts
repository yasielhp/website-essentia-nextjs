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
import { bookingReminderEmail } from "@/emails/templates/booking-reminder";

/**
 * The real reminder cron, with the database and the mailer replaced. With no
 * edited reminder, or one that cannot be read, each client gets the legacy
 * email byte for byte. A switched-off reminder sends nothing and stamps
 * nothing.
 */

type Email = { to: string; subject: string; html: string };

let batches: Email[][] = [];
let stamped: string[][] = [];
let templates: () => { data: unknown; error: unknown } = () => ({
  data: null,
  error: null,
});

const startsAt = new Date(Date.now() + 48 * 3_600_000);
const pad = (n: number) => String(n).padStart(2, "0");
const DATE = `${startsAt.getFullYear()}-${pad(startsAt.getMonth() + 1)}-${pad(startsAt.getDate())}`;
const TIME = `${pad(startsAt.getHours())}:${pad(startsAt.getMinutes())}`;

const BOOKING = {
  id: "b-1",
  email: "ana@example.test",
  first_name: "Ana",
  service_title: "Drenaje linfático",
  date: DATE,
  time: TIME,
  duration: "60 min",
  cancel_token: "tok-123",
  service_tiers: { label: "Sesión individual" },
};

const SECOND = {
  ...BOOKING,
  id: "b-2",
  email: "luis@example.test",
  first_name: "Luis",
  cancel_token: "tok-456",
};
let bookingsInRun: (typeof BOOKING)[] = [BOOKING];
let templateReads = 0;

function chain(result: () => unknown, onIn?: (ids: string[]) => void): unknown {
  const proxy: unknown = new Proxy(() => {}, {
    get(_t, prop) {
      if (prop === "then") {
        return (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => {
          try {
            return Promise.resolve(result()).then(ok, bad);
          } catch (err) {
            return Promise.reject(err).then(ok, bad);
          }
        };
      }
      if (prop === "in") {
        return (col: string, ids: string[]) => {
          if (col === "id") onIn?.(ids);
          return proxy;
        };
      }
      return () => proxy;
    },
    apply: () => proxy,
  });
  return proxy;
}

const fakeAdmin = {
  getAdminClient: () => ({
    database: {
      from: (table: string) => {
        if (table === "message_templates") {
          return chain(() => {
            templateReads++;
            return templates();
          });
        }
        if (table === "bookings") {
          return chain(
            () => ({ data: bookingsInRun, error: null }),
            (ids) => stamped.push(ids),
          );
        }
        return chain(() => ({ data: null, error: null }));
      },
    },
  }),
};

const real = {
  admin: { ...(await import("@/lib/insforge-admin")) },
  send: { ...(await import("@/emails/send")) },
  security: { ...(await import("@/lib/auth-security")) },
};

let GET: (r: NextRequest) => Promise<Response>;

beforeAll(async () => {
  process.env.CRON_SECRET = "s3cret";
  process.env.NEXT_PUBLIC_APP_URL = "https://app.example.test";
  mock.module("@/lib/insforge-admin", () => fakeAdmin);
  mock.module("@/emails/send", () => ({
    ...real.send,
    sendEmailBatch: async (emails: Email[]) => {
      batches.push(emails);
      return { sent: emails.length, error: null };
    },
  }));
  mock.module("@/lib/auth-security", () => ({
    ...real.security,
    pruneAuthEvents: async () => {},
  }));
  ({ GET } = await import("./route"));
});

afterAll(() => {
  mock.module("@/lib/insforge-admin", () => real.admin);
  mock.module("@/emails/send", () => real.send);
  mock.module("@/lib/auth-security", () => real.security);
});

beforeEach(() => {
  batches = [];
  stamped = [];
  templates = () => ({ data: null, error: null });
  bookingsInRun = [BOOKING];
  templateReads = 0;
});

const run = () =>
  GET(
    new NextRequest("https://app.example.test/api/cron/booking-reminders", {
      headers: { authorization: "Bearer s3cret" },
    }),
  );

function legacy(b: typeof BOOKING = BOOKING): Email {
  const date = new Date(
    startsAt.getFullYear(),
    startsAt.getMonth(),
    startsAt.getDate(),
  ).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return {
    to: b.email,
    subject: `Tu sesión del ${date} — Drenaje linfático`,
    html: bookingReminderEmail({
      name: b.first_name,
      service: "Drenaje linfático",
      sessionType: "Sesión individual",
      date,
      time: TIME,
      duration: "60 min",
      dateIso: DATE,
      cancelUrl: `https://app.example.test/es/reserva/cancelar?token=${b.cancel_token}`,
      locale: "es",
    }),
  };
}

describe("booking reminders", () => {
  test("no saved row: the legacy email, byte for byte, and the booking is stamped", async () => {
    const res = await run();
    expect(await res.json()).toMatchObject({ sent: 1 });
    expect(batches).toHaveLength(1);
    expect(batches[0]).toEqual([legacy()]);
    expect(stamped).toEqual([["b-1"]]);
  });

  test("the database cannot be read: still the legacy email", async () => {
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    templates = () => {
      throw new Error("db down");
    };
    await run();
    quiet.mockRestore();
    expect(batches[0]).toEqual([legacy()]);
  });

  test("an edited reminder: the admin's subject and body go out", async () => {
    templates = () => ({
      data: {
        subject: "Recordatorio para {{first_name}}",
        preheader: null,
        title: null,
        doc: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Te vemos pronto en {{service}}." },
              ],
            },
          ],
        },
        enabled: true,
      },
      error: null,
    });
    await run();
    expect(batches[0]).toHaveLength(1);
    expect(batches[0]![0]!.subject).toBe("Recordatorio para Ana");
    expect(batches[0]![0]!.html).toContain(
      "Te vemos pronto en Drenaje linfático.",
    );
    expect(batches[0]![0]!.html).toContain("Cancelar mi cita");
    expect(stamped).toEqual([["b-1"]]);
  });

  test("a reminder switched off sends nothing and stamps nothing", async () => {
    const info = spyOn(console, "info").mockImplementation(() => {});
    templates = () => ({
      data: {
        subject: null,
        preheader: null,
        title: null,
        doc: null,
        enabled: false,
      },
      error: null,
    });
    const res = await run();
    info.mockRestore();
    expect(await res.json()).toMatchObject({ sent: 0, skipped: 1 });
    expect(batches).toEqual([]);
    expect(stamped).toEqual([]);
  });

  test("two bookings in one run: the message is read once, each gets the legacy email", async () => {
    bookingsInRun = [BOOKING, SECOND];
    await run();
    expect(templateReads).toBe(1);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toEqual([legacy(BOOKING), legacy(SECOND)]);
    expect(stamped).toEqual([["b-1", "b-2"]]);
  });

  test("an unreadable message is read once and every booking still gets the legacy email", async () => {
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    bookingsInRun = [BOOKING, SECOND];
    templates = () => {
      throw new Error("db down");
    };
    await run();
    quiet.mockRestore();
    expect(templateReads).toBe(1);
    expect(batches[0]).toEqual([legacy(BOOKING), legacy(SECOND)]);
  });

  test("switched off with two bookings: one log line with the count, nothing sent or stamped", async () => {
    const info = spyOn(console, "info").mockImplementation(() => {});
    bookingsInRun = [BOOKING, SECOND];
    templates = () => ({
      data: {
        subject: null,
        preheader: null,
        title: null,
        doc: null,
        enabled: false,
      },
      error: null,
    });
    const res = await run();
    const lines = info.mock.calls.map((c) => String(c[0]));
    info.mockRestore();
    expect(templateReads).toBe(1);
    expect(await res.json()).toMatchObject({ sent: 0, skipped: 2 });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("2 not sent");
    expect(batches).toEqual([]);
    expect(stamped).toEqual([]);
  });

  test("no bookings in the window: the message is not read at all", async () => {
    bookingsInRun = [];
    await run();
    expect(templateReads).toBe(0);
  });
});
