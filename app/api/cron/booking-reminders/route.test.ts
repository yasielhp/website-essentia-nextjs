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

/** What a chain was asked: whether it is an UPDATE, the ids it names, its steps. */
type Asked = { update: boolean; ids: string[]; steps: string[] };

function chain(
  result: (asked: Asked) => unknown,
  onIn?: (ids: string[]) => void,
): unknown {
  const asked: Asked = { update: false, ids: [], steps: [] };
  const proxy: unknown = new Proxy(() => {}, {
    get(_t, prop) {
      if (prop === "then") {
        return (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => {
          try {
            return Promise.resolve(result(asked)).then(ok, bad);
          } catch (err) {
            return Promise.reject(err).then(ok, bad);
          }
        };
      }
      asked.steps.push(String(prop));
      if (prop === "update") asked.update = true;
      if (prop === "in") {
        return (col: string, ids: string[]) => {
          if (col === "id") {
            asked.ids = ids;
            onIn?.(ids);
          }
          return proxy;
        };
      }
      return () => proxy;
    },
    apply: () => proxy,
  });
  return proxy;
}

/** What the stamp answers: by default, every booking it named is now stamped. */
let stamp: (ids: string[]) => { data: unknown; error: unknown } = (ids) => ({
  data: ids.map((id) => ({ id })),
  error: null,
});
let stampSteps: string[] = [];
/** Every UPDATE of `bookings`, with the ids it named. */
let bookingUpdates: { ids: string[]; steps: string[] }[] = [];

type Sent = { sent: number; ids: (string | null)[]; error: string | null };
/** What Resend answers: by default it takes every email. */
const takesAll = (emails: Email[]): Sent => ({
  sent: emails.length,
  ids: emails.map((email) => `re_${email.to}`),
  error: null,
});
let mailer: (emails: Email[]) => Sent = takesAll;
const KEY = process.env.RESEND_API_KEY;

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
            (asked) => {
              if (!asked.update) return { data: bookingsInRun, error: null };
              stampSteps = asked.steps;
              bookingUpdates.push({ ids: asked.ids, steps: asked.steps });
              return stamp(asked.ids);
            },
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
  // Never used: the mailer below stands in for Resend.
  process.env.RESEND_API_KEY = "test-key";
  mock.module("@/lib/insforge-admin", () => fakeAdmin);
  mock.module("@/emails/send", () => ({
    ...real.send,
    sendEmailBatch: async (emails: Email[]) => {
      batches.push(emails);
      return mailer(emails);
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
  if (KEY === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = KEY;
});

beforeEach(() => {
  batches = [];
  stamped = [];
  templates = () => ({ data: null, error: null });
  bookingsInRun = [BOOKING];
  templateReads = 0;
  stamp = (ids) => ({ data: ids.map((id) => ({ id })), error: null });
  stampSteps = [];
  bookingUpdates = [];
  mailer = takesAll;
  process.env.RESEND_API_KEY = "test-key";
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

  test("the stamp cannot be written: nobody is mailed, it is logged and the answer is a 500", async () => {
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    bookingsInRun = [BOOKING, SECOND];
    stamp = () => ({ data: null, error: { message: "connection reset" } });
    const res = await run();
    const lines = quiet.mock.calls.map((c) => String(c[0]));
    quiet.mockRestore();
    // Unstamped and mailed, they would be mailed again every hour.
    expect(batches).toEqual([]);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Stamp failed" });
    expect(lines.some((l) => l.includes("stamp failed"))).toBe(true);
  });

  test("only the bookings the stamp took are mailed: another run got the other first", async () => {
    bookingsInRun = [BOOKING, SECOND];
    stamp = () => ({ data: [{ id: "b-1" }], error: null });
    const res = await run();
    expect(batches).toEqual([[legacy(BOOKING)]]);
    expect(await res.json()).toMatchObject({ sent: 1, skipped: 1 });
  });

  test("a stamp that took nobody mails nobody", async () => {
    stamp = () => ({ data: [], error: null });
    const res = await run();
    expect(batches).toEqual([]);
    expect(await res.json()).toMatchObject({ ok: true, sent: 0, skipped: 1 });
  });

  test("the stamp only takes a booking nobody has stamped, and asks which it took", async () => {
    await run();
    expect(stampSteps).toEqual(["update", "in", "is", "select"]);
  });

  test("with no key to send with nothing is stamped: the reminder is still owed", async () => {
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    delete process.env.RESEND_API_KEY;
    const res = await run();
    const logged = quiet.mock.calls.length;
    quiet.mockRestore();
    expect(stamped).toEqual([]);
    expect(batches).toEqual([]);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "RESEND_API_KEY not set" });
    expect(logged).toBeGreaterThan(0);
  });

  test("a send that fails after the stamp is not a quiet loss: the bookings are named and the answer is a 500", async () => {
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    bookingsInRun = [BOOKING, SECOND];
    // Resend took the first chunk's first email and nothing is known of the
    // second: it may or may not have left.
    mailer = (emails) => ({
      sent: 1,
      ids: [`re_${emails[0]!.to}`, null],
      error: "fetch failed",
    });
    const res = await run();
    const lines = quiet.mock.calls.map((c) => c.map(String).join(" "));
    quiet.mockRestore();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "Send failed",
      sent: 1,
      skipped: 0,
      unsent: ["b-2"],
    });
    expect(lines.some((l) => l.includes("b-2") && !l.includes("b-1"))).toBe(
      true,
    );
    // The stamp stays: mailing somebody twice is worse than not at all.
    expect(bookingUpdates).toHaveLength(1);
  });

  test("a send that takes every email answers as before", async () => {
    bookingsInRun = [BOOKING, SECOND];
    const res = await run();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, sent: 2, skipped: 0 });
    expect(bookingUpdates).toHaveLength(1);
  });
});
