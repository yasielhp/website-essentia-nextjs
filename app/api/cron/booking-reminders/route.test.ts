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
type Asked = {
  update: boolean;
  /** What an UPDATE sets. */
  patch: Record<string, unknown>;
  ids: string[];
  steps: string[];
};

function chain(
  result: (asked: Asked) => unknown,
  onIn?: (ids: string[]) => void,
): unknown {
  const asked: Asked = { update: false, patch: {}, ids: [], steps: [] };
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
      if (prop === "update") {
        return (patch: Record<string, unknown>) => {
          asked.update = true;
          asked.patch = patch;
          return proxy;
        };
      }
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
/** The bookings that hold a stamp right now, after every stamp and take-back. */
let holds = new Set<string>();
/** The stamps taken back, and what taking them back answers. */
let unstamped: string[][] = [];
let unstamp: () => { data: unknown; error: unknown } = () => ({
  data: null,
  error: null,
});

type Sent = {
  sent: number;
  ids: (string | null)[];
  error: string | null;
  rejected: boolean;
};
/** What Resend answers: by default it takes every email. */
const takesAll = (emails: Email[]): Sent => ({
  sent: emails.length,
  ids: emails.map((email) => `re_${email.to}`),
  error: null,
  rejected: false,
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
          return chain((asked) => {
            if (!asked.update) return { data: bookingsInRun, error: null };
            bookingUpdates.push({ ids: asked.ids, steps: asked.steps });
            if (asked.patch.reminder_sent_at === null) {
              unstamped.push(asked.ids);
              const undone = unstamp();
              if (!undone.error) for (const id of asked.ids) holds.delete(id);
              return undone;
            }
            stampSteps = asked.steps;
            stamped.push(asked.ids);
            const done = stamp(asked.ids);
            for (const row of (done.data ?? []) as { id: string }[]) {
              holds.add(row.id);
            }
            return done;
          });
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
  unstamped = [];
  holds = new Set();
  unstamp = () => ({ data: null, error: null });
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
      rejected: false,
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
    expect(unstamped).toEqual([]);
  });

  test("a lot of one that Resend refused: its stamp is taken back, for the next run to try again", async () => {
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    mailer = (emails) => ({
      sent: 0,
      ids: emails.map(() => null),
      error: "Too many requests",
      rejected: true,
    });
    const res = await run();
    const logged = quiet.mock.calls.length;
    quiet.mockRestore();
    // Asked once: with nobody else in the lot there is nothing to tell apart.
    expect(batches).toHaveLength(1);
    expect(unstamped).toEqual([["b-1"]]);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "Send refused",
      sent: 0,
      skipped: 0,
      retry: ["b-1"],
    });
    expect(logged).toBeGreaterThan(0);
  });

  test("a refused send whose stamps cannot be taken back says who is left without a reminder", async () => {
    const quiet = spyOn(console, "error").mockImplementation(() => {});
    mailer = () => ({
      sent: 0,
      ids: [null],
      error: "API key is invalid",
      rejected: true,
    });
    unstamp = () => ({ data: null, error: { message: "connection reset" } });
    const res = await run();
    const lines = quiet.mock.calls.map((c) => c.map(String).join(" "));
    quiet.mockRestore();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "Send failed",
      sent: 0,
      skipped: 0,
      unsent: ["b-1"],
    });
    expect(lines.some((l) => l.includes("b-1"))).toBe(true);
  });

  test("a send that takes every email answers as before", async () => {
    bookingsInRun = [BOOKING, SECOND];
    const res = await run();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, sent: 2, skipped: 0 });
    expect(bookingUpdates).toHaveLength(1);
  });

  describe("a lot Resend refused whole is sent again one by one", () => {
    const THIRD = {
      ...BOOKING,
      id: "b-3",
      email: "marta@example.test",
      first_name: "Marta",
      cancel_token: "tok-789",
    };
    const BAD = { ...SECOND, email: "luis@example" };
    const refusal = (emails: Email[], error: string): Sent => ({
      sent: 0,
      ids: emails.map(() => null),
      error,
      rejected: true,
    });
    /** Resend validates a lot as a whole: one bad address and none of it goes. */
    const strict =
      (bad: string[]) =>
      (emails: Email[]): Sent =>
        emails.some((e) => bad.includes(e.to))
          ? refusal(emails, "Invalid `to` field")
          : takesAll(emails);

    let timers: ReturnType<typeof spyOn>;
    let quiet: ReturnType<typeof spyOn>;
    beforeEach(() => {
      // The pause between one email and the next, without the wait.
      timers = spyOn(globalThis, "setTimeout").mockImplementation(((
        fn: () => void,
      ) => {
        fn();
        return 0;
      }) as never);
      quiet = spyOn(console, "error").mockImplementation(() => {});
    });
    const done = (): string[] => {
      const lines: string[] = quiet.mock.calls.map((c: unknown[]) =>
        c.map(String).join(" "),
      );
      timers.mockRestore();
      quiet.mockRestore();
      return lines;
    };

    test("three bookings and one bad address: two reminders go out, and the third is named and left to try again", async () => {
      bookingsInRun = [BOOKING, BAD, THIRD];
      mailer = strict([BAD.email]);
      const res = await run();
      const lines = done();
      // The lot, then each of the three alone, in their order.
      expect(batches.map((b) => b.map((e) => e.to))).toEqual([
        [BOOKING.email, BAD.email, THIRD.email],
        [BOOKING.email],
        [BAD.email],
        [THIRD.email],
      ]);
      // What went out alone is the very email of the lot.
      expect(batches[1]).toEqual([legacy(BOOKING)]);
      // The refused lot gives every stamp back at once; each booking takes
      // its own again as its turn comes, and the one refused alone loses it
      // there and then.
      expect(unstamped).toEqual([["b-1", "b-2", "b-3"], ["b-2"]]);
      expect([...holds].sort()).toEqual(["b-1", "b-3"]);
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        error: "Send refused",
        sent: 2,
        skipped: 0,
        retry: ["b-2"],
      });
      expect(lines.some((l) => l.includes("b-2") && !l.includes("b-1"))).toBe(
        true,
      );
    });

    test("a lot refused for a moment (a rate limit) that then goes out one by one: everybody has their reminder", async () => {
      bookingsInRun = [BOOKING, SECOND, THIRD];
      let first = true;
      mailer = (emails) => {
        if (!first) return takesAll(emails);
        first = false;
        return refusal(emails, "Too many requests");
      };
      const res = await run();
      done();
      expect([...holds].sort()).toEqual(["b-1", "b-2", "b-3"]);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, sent: 3, skipped: 0 });
    });

    test("one that gets no answer when sent alone keeps its stamp: it may have left", async () => {
      bookingsInRun = [BOOKING, BAD, THIRD];
      mailer = (emails) => {
        if (emails.length === 1 && emails[0]!.to === THIRD.email) {
          return {
            sent: 0,
            ids: [null],
            error: "fetch failed",
            rejected: false,
          };
        }
        return strict([BAD.email])(emails);
      };
      const res = await run();
      done();
      expect([...holds].sort()).toEqual(["b-1", "b-3"]);
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        error: "Send failed",
        sent: 1,
        skipped: 0,
        unsent: ["b-3"],
        retry: ["b-2"],
      });
    });

    test("three refused in a row is not one bad address: it stops asking and leaves the rest for the next run", async () => {
      const FOURTH = { ...BOOKING, id: "b-4", email: "eva@example.test" };
      const FIFTH = { ...BOOKING, id: "b-5", email: "sol@example.test" };
      bookingsInRun = [BOOKING, SECOND, THIRD, FOURTH, FIFTH];
      mailer = (emails) => refusal(emails, "API key is invalid");
      const res = await run();
      done();
      // The lot and three alone; the other two are not asked for.
      expect(batches).toHaveLength(4);
      expect(holds.size).toBe(0);
      expect(await res.json()).toEqual({
        error: "Send refused",
        sent: 0,
        skipped: 0,
        retry: ["b-1", "b-2", "b-3", "b-4", "b-5"],
      });
    });

    test("out of time half way: what was not tried loses its stamp too, for the next hour", async () => {
      bookingsInRun = [BOOKING, BAD, THIRD];
      const realNow = Date.now.bind(Date);
      let ahead = 0;
      const clock = spyOn(Date, "now").mockImplementation(
        () => realNow() + ahead,
      );
      mailer = (emails) => {
        const answer = strict([BAD.email])(emails);
        // The first email alone takes the rest of the function's time.
        if (emails.length === 1) ahead = 60_000;
        return answer;
      };
      const res = await run();
      clock.mockRestore();
      done();
      expect(batches).toHaveLength(2);
      expect([...holds]).toEqual(["b-1"]);
      expect(await res.json()).toEqual({
        error: "Send refused",
        sent: 1,
        skipped: 0,
        retry: ["b-2", "b-3"],
      });
    });

    test("the function dies while one email hangs: nobody is left stamped without having been tried", async () => {
      bookingsInRun = [BOOKING, SECOND, THIRD];
      let call = 0;
      mailer = (emails) => {
        call += 1;
        if (call === 1) return refusal(emails, "Too many requests");
        // The second email alone never comes back: the platform cuts the run.
        if (call === 3) throw new Error("function killed");
        return takesAll(emails);
      };
      await expect(run()).rejects.toThrow("function killed");
      const lines = done();
      // The first has its reminder; the one in flight may have left, so it
      // keeps its stamp; the third was never tried and is still owed.
      expect([...holds].sort()).toEqual(["b-1", "b-2"]);
      // And the stamps given back were named before anything was sent alone.
      expect(lines.some((l) => l.includes("b-3"))).toBe(true);
    });

    test("a booking whose stamp cannot be taken again is not mailed: it stays owed", async () => {
      bookingsInRun = [BOOKING, SECOND, THIRD];
      let first = true;
      mailer = (emails) => {
        if (!first) return takesAll(emails);
        first = false;
        return refusal(emails, "Too many requests");
      };
      const stampAll = stamp;
      let stamps = 0;
      stamp = (ids) => {
        stamps += 1;
        // The lot's stamp, then b-1's; b-2's fails.
        return stamps === 3
          ? { data: null, error: { message: "connection reset" } }
          : stampAll(ids);
      };
      const res = await run();
      done();
      expect(batches.map((b) => b.map((e) => e.to))).toEqual([
        [BOOKING.email, SECOND.email, THIRD.email],
        [BOOKING.email],
        [THIRD.email],
      ]);
      expect([...holds].sort()).toEqual(["b-1", "b-3"]);
      expect(await res.json()).toEqual({
        error: "Send refused",
        sent: 2,
        skipped: 0,
        retry: ["b-2"],
      });
    });

    test("the stamps of a refused lot that cannot be given back: nobody is mailed alone, and they are named", async () => {
      bookingsInRun = [BOOKING, SECOND, THIRD];
      mailer = (emails) => refusal(emails, "Too many requests");
      unstamp = () => ({ data: null, error: { message: "connection reset" } });
      const res = await run();
      const lines = done();
      expect(batches).toHaveLength(1);
      expect(await res.json()).toEqual({
        error: "Send failed",
        sent: 0,
        skipped: 0,
        unsent: ["b-1", "b-2", "b-3"],
      });
      expect(lines.some((l) => l.includes("b-1, b-2, b-3"))).toBe(true);
    });
  });
});
