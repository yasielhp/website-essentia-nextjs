import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { NO_OVERLAP_CONSTRAINT } from "./slot-taken";

/**
 * Read from the SOURCE: nothing that runs in the browser, or holds its client,
 * writes `bookings`, or calls a function of the database that does.
 *
 * The public booking form used to: a draft through `create_draft_booking`, its
 * hour through `update_booking_datetime` and, without a draft, the booking
 * itself through the open INSERT policy; the desk's "New booking" inserted
 * from the browser too. Those writes are the server's now
 * (`app/actions/public-booking.ts`, `app/actions/desk-booking.ts`).
 *
 * THIS IS A REMINDER, NOT THE BARRIER. Being text, it cannot see a table name
 * put together at run time, nor what a function does once called. The barrier
 * is `insforge/migrations/20261124_bookings_close_browser_writes.sql`: no write
 * policy, the browser roles' INSERT, UPDATE and DELETE revoked, and EXECUTE on
 * the writing functions taken from them. Below, that file is read too, and
 * the one that makes the database refuse two bookings on one hour.
 */

const ROOT = join(import.meta.dir, "..", "..", "..");
const isSource = (name: string) =>
  /\.tsx?$/.test(name) &&
  !/\.test\.tsx?$/.test(name) &&
  !/\.d\.ts$/.test(name) &&
  // Somebody's scratch file (`.wa-*.tmp.ts`) is not the app.
  !name.startsWith(".");
const under = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return under(path);
    return isSource(entry.name) ? [path] : [];
  });
const all = [
  ...under(join(ROOT, "app")),
  ...under(join(ROOT, "scripts")),
  ...under(join(ROOT, "i18n")),
  ...readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isSource(entry.name))
    .map((entry) => join(ROOT, entry.name)),
]
  .map((path) => relative(ROOT, path))
  .sort();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const NAMED = `["'\`]bookings["'\`]`;
/**
 * `from("bookings")` that does not go straight on to `.select(`: an update, an
 * insert, an upsert, a delete, or a builder kept in a variable, which could be
 * any of them a line later.
 */
const NOT_A_READ = new RegExp(`from\\(\\s*${NAMED}\\s*\\)(?!\\s*\\.select\\()`);
/** The name given to a variable or a property, to reach `from(` another way. */
const ALIASED = new RegExp(
  `(?<![=!<>])=\\s*${NAMED}|[\\w$\\]?]\\s*:\\s*${NAMED}`,
);
/** The client the browser holds (the public key, or a user's session). */
const BROWSER_CLIENT = /from\s+["']@\/?lib\/insforge(-public)?["']/;
const runsInBrowser = (source: string) =>
  /^\s*["']use client["']/m.test(source) || BROWSER_CLIENT.test(source);

/** The functions of the database that write `bookings` (read in `pg_proc`). */
const WRITING_FUNCTIONS = [
  "create_draft_booking",
  "update_booking_datetime",
  "confirm_booking",
  "update_booking_returning_previous",
];
const calls = (fn: string) => new RegExp(`\\.rpc\\(\\s*["'\`]${fn}["'\`]`);

/**
 * Every module that writes `bookings`, on 2026-11-24. All of them run on the
 * server with the service key. A new one fails here until it has been read:
 * it must not run in the browser, it must check who is asking (or be a job, a
 * webhook or the form's own strict action), and if it can put a booking on a
 * professional's hour it must say "slot_taken" in words (`isSlotTaken`).
 */
const WRITERS = [
  "app/actions/bonuses.ts",
  "app/actions/booking-cancellation.ts",
  "app/actions/booking-draft.ts",
  "app/actions/booking-payment.ts",
  "app/actions/booking-refunds.ts",
  "app/actions/delete-contact.ts",
  "app/api/checkout/booking-session/route.ts",
  "app/api/cron/booking-reminders/route.ts",
  "app/api/google/calendar/sync-user/route.ts",
  "app/api/google/calendar/sync/route.ts",
  "app/api/webhooks/redsys/route.ts",
  "app/lib/bookings/desk-create.ts",
  "app/lib/bookings/for-staff.ts",
  "app/lib/bookings/public-booking.ts",
  "app/lib/bookings/run-expire-unpaid.ts",
  "app/lib/calendar-propagate.ts",
  "app/lib/calendar-sync.ts",
  "app/services/booking-payments.service.ts",
];

describe("nothing in the browser writes a booking", () => {
  test("it reads the app, the scripts and the root, tests and scratch files aside", () => {
    expect(all).toContain("proxy.ts");
    expect(all).toContain("app/components/sections/booking/booking-submit.ts");
    expect(all.some((path) => path.includes(".test."))).toBe(false);
    expect(all.length).toBeGreaterThan(500);
  });

  test("no module that runs in the browser, or holds its client, writes `bookings`", () => {
    const browser = all.filter((path) => runsInBrowser(read(path)));
    expect(browser.length).toBeGreaterThan(50);
    expect(browser).toContain(
      "app/components/sections/booking/booking-submit.ts",
    );
    expect(browser).toContain(
      "app/(dashboard)/dashboard/bookings/new/create-booking.ts",
    );
    expect(browser.filter((path) => NOT_A_READ.test(read(path)))).toEqual([]);
  });

  test("the writers are the server's, each on the service key, and no other module writes", () => {
    expect(all.filter((path) => NOT_A_READ.test(read(path)))).toEqual(WRITERS);
    for (const path of WRITERS) {
      const source = read(path);
      expect({ path, browser: runsInBrowser(source) }).toEqual({
        path,
        browser: false,
      });
      expect({ path, serviceKey: source.includes("getAdminClient") }).toEqual({
        path,
        serviceKey: true,
      });
    }
  });

  test("the functions of the database that write a booking are not called from the browser, and the form's old ones not at all", () => {
    for (const fn of WRITING_FUNCTIONS) {
      const callers = all.filter((path) => calls(fn).test(read(path)));
      expect({ fn, callers }).toEqual({
        fn,
        // The dashboard's edit, from the server, as an administrator, staff
        // or the partner whose booking it is. The other three were the public
        // form's, from the browser: their EXECUTE is revoked.
        callers:
          fn === "update_booking_returning_previous"
            ? ["app/actions/booking-draft.ts"]
            : [],
      });
    }
  });

  test("the table goes under no other name; where the word is a key of the screen, it is not the table", () => {
    // A section of the contact page, a card of Settings, a key of the menu and
    // a filter of the segments: none reaches `from(`.
    expect(all.filter((path) => ALIASED.test(read(path)))).toEqual([
      "app/(dashboard)/dashboard-shell.tsx",
      "app/(dashboard)/dashboard/contacts/[id]/page.tsx",
      "app/(dashboard)/dashboard/settings/settings-sections.tsx",
      "app/constants/nav.tsx",
      "app/lib/campaigns/segment-people.ts",
    ]);
    for (const path of [
      "app/(dashboard)/dashboard-shell.tsx",
      "app/(dashboard)/dashboard/contacts/[id]/page.tsx",
      "app/(dashboard)/dashboard/settings/settings-sections.tsx",
      "app/constants/nav.tsx",
      "app/lib/campaigns/segment-people.ts",
    ]) {
      expect({ path, from: /\.from\(/.test(read(path)) }).toEqual({
        path,
        from: false,
      });
    }
    // The checks themselves.
    expect(NOT_A_READ.test('const q = db.from("bookings");')).toBe(true);
    expect(NOT_A_READ.test('db.from("bookings").insert([row])')).toBe(true);
    expect(NOT_A_READ.test('db\n  .from("bookings")\n  .select("id")')).toBe(
      false,
    );
    expect(ALIASED.test('const T = "bookings";')).toBe(true);
    expect(ALIASED.test('if (table === "bookings")')).toBe(false);
  });
});

describe("the doors that write instead of the browser", () => {
  test("the public form's: a server action over strict schemas and the service key", () => {
    const door = read("app/actions/public-booking.ts");
    const core = read("app/lib/bookings/public-booking.ts");
    expect({
      server: /^\s*["']use server["']/m.test(door),
      onlyAsyncFunctions: !/export\s+(const|type|let|class|\{)/.test(door),
      strict: (core.match(/z\.strictObject\(/g) ?? []).length,
      serviceKey: core.includes("getAdminClient()"),
      // The account is the one the token proves, never one the browser sends.
      verifiedAccount: core.includes("authenticate(accessToken)"),
      browserClient: runsInBrowser(core),
    }).toEqual({
      server: true,
      onlyAsyncFunctions: true,
      strict: 3,
      serviceKey: true,
      verifiedAccount: true,
      browserClient: false,
    });
  });

  test("the desk's: the team only, over a strict schema", () => {
    const door = read("app/actions/desk-booking.ts");
    const core = read("app/lib/bookings/desk-create.ts");
    expect({
      server: /^\s*["']use server["']/m.test(door),
      team: door.includes("requireRole(accessToken)"),
      strict: /z\.strictObject\(/.test(core),
      serviceKey: core.includes("getAdminClient()"),
      partnerOwnsHers: core.includes("partner_id: actor.userId"),
    }).toEqual({
      server: true,
      team: true,
      strict: true,
      serviceKey: true,
      partnerOwnsHers: true,
    });
  });

  test("the forms go through them", () => {
    const form = read("app/components/sections/booking/booking-submit.ts");
    const desk = read(
      "app/(dashboard)/dashboard/bookings/new/create-booking.ts",
    );
    expect({
      draft: form.includes("savePublicDraft("),
      hour: form.includes("setPublicDraftTime("),
      confirm: form.includes("confirmPublicBooking("),
      desk: desk.includes("createDeskBooking("),
    }).toEqual({ draft: true, hour: true, confirm: true, desk: true });
  });

  test("every dashboard action on one booking checks whose it is (a partner, only hers) on the server", () => {
    // `bookingAccess` (app/lib/bookings/booking-access.ts): admin and staff
    // any booking, a partner only her own, anybody else none; run for real in
    // app/actions/booking-partner-scope.test.ts.
    for (const [path, calls] of [
      ["app/actions/booking-draft.ts", 4],
      ["app/actions/booking-payment.ts", 1],
      ["app/actions/bonuses.ts", 2],
      ["app/actions/booking-notifications.ts", 1],
      ["app/actions/staff-whatsapp.ts", 1],
      ["app/actions/calendar-propagate.ts", 2],
    ] as const) {
      const found = (read(path).match(/bookingAccess\(/g) ?? []).length;
      expect({ path, calls: found }).toEqual({ path, calls });
    }
    const edit = read("app/actions/booking-draft.ts");
    expect(
      read("app/actions/booking-draft.ts").includes(
        'requireRole(accessToken, ["admin", "staff"])',
      ),
    ).toBe(true);
  });

  test("every write that can put a booking on a professional's hour says 'taken' in words", () => {
    for (const path of [
      "app/lib/bookings/public-booking.ts",
      "app/lib/bookings/desk-create.ts",
      "app/lib/bookings/for-staff.ts",
      "app/actions/booking-draft.ts",
      "app/services/booking-payments.service.ts",
    ]) {
      expect({ path, maps: read(path).includes("isSlotTaken(") }).toEqual({
        path,
        maps: true,
      });
    }
  });
});

const migration = (file: string) => {
  const text = readFileSync(join(ROOT, "insforge", "migrations", file), "utf8");
  // What CLAUDE.md's command sends: comments and BEGIN/COMMIT stripped.
  const sent = text
    .split("\n")
    .filter((line) => !line.startsWith("--") && !/^(BEGIN|COMMIT);$/.test(line))
    .join("\n");
  return { text, sent };
};

describe("the migration that closes the table to the browser", () => {
  const { text, sent } = migration(
    "20261124_bookings_close_browser_writes.sql",
  );

  test("it says it is not applied, and what is sent does not open with a comment", () => {
    expect(text.startsWith("-- NOT APPLIED.")).toBe(true);
    expect(sent.trimStart().startsWith("--")).toBe(false);
    expect(/^BEGIN;$/m.test(text) && /^COMMIT;$/m.test(text)).toBe(true);
  });

  test("RLS stays on, and every policy it makes is a read", () => {
    expect(sent).toContain("ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;");
    const policies = [...sent.matchAll(/CREATE POLICY[\s\S]*?;/g)].map(
      (m) => m[0],
    );
    expect(policies).toHaveLength(3);
    for (const policy of policies) {
      expect(/\bFOR SELECT\b/.test(policy)).toBe(true);
      expect(/\bFOR (ALL|INSERT|UPDATE|DELETE)\b/.test(policy)).toBe(false);
    }
    // A client by her account id, never by an address she can rewrite.
    expect(sent).toMatch(
      /users_select_own_bookings[\s\S]*?USING \(user_id = auth\.uid\(\)\)/,
    );
    expect(sent).toMatch(
      /partners_read_own_bookings[\s\S]*?USING \(partner_id = auth\.uid\(\)\)/,
    );
    expect(sent).not.toMatch(/profiles|\bemail\b/);
  });

  test("the five write policies go, and are dropped before anything is made, so it can run again", () => {
    for (const name of [
      "anyone_insert_bookings",
      "partners_insert_bookings",
      "users_update_own_bookings",
      "partners_update_own_bookings",
      "admin_update_any_booking",
    ]) {
      expect(sent).toContain(`DROP POLICY IF EXISTS "${name}" ON bookings;`);
      expect(sent).not.toContain(`CREATE POLICY "${name}"`);
    }
    for (const [, name] of sent.matchAll(/CREATE POLICY "(\w+)"/g)) {
      const drop = sent.indexOf(`DROP POLICY IF EXISTS "${name}" ON bookings;`);
      expect(drop).toBeGreaterThan(-1);
      expect(drop).toBeLessThan(sent.indexOf(`CREATE POLICY "${name}"`));
    }
  });

  test("the browser roles lose the writes and the writing functions", () => {
    expect(sent).toContain(
      "REVOKE INSERT, UPDATE, DELETE ON bookings FROM anon, authenticated;",
    );
    for (const fn of WRITING_FUNCTIONS) {
      expect(sent).toMatch(
        new RegExp(
          `REVOKE EXECUTE ON FUNCTION ${fn}\\([^)]*\\) FROM PUBLIC, anon, authenticated;`,
        ),
      );
    }
    expect(sent).not.toMatch(/\bGRANT\b/);
  });
});

describe("the migration that refuses two bookings on one hour", () => {
  const { text, sent } = migration("20261124_bookings_no_overlap.sql");

  test("it says it is not applied, and what is sent does not open with a comment", () => {
    expect(text.startsWith("-- NOT APPLIED.")).toBe(true);
    expect(sent.trimStart().startsWith("--")).toBe(false);
  });

  test("an exclusion constraint by professional and hour, with the name the code reads", () => {
    expect(sent).toContain("CREATE EXTENSION IF NOT EXISTS btree_gist;");
    expect(sent).toContain(
      `ALTER TABLE bookings DROP CONSTRAINT IF EXISTS ${NO_OVERLAP_CONSTRAINT};`,
    );
    expect(sent).toMatch(
      new RegExp(
        `ADD CONSTRAINT ${NO_OVERLAP_CONSTRAINT}\\s+EXCLUDE USING gist \\(\\s*staff_id WITH =,\\s*booking_slot\\(date, time, duration\\) WITH &&\\s*\\)`,
      ),
    );
    // Built by a function an index may use.
    expect(sent).toMatch(/FUNCTION booking_slot\([\s\S]*?\bIMMUTABLE\b/);
  });

  test("what holds a slot is what the calendar says holds one, drafts aside", () => {
    // `holdsSlot`: cancelled never holds; a draft holds for an hour, which a
    // constraint cannot say, so the database leaves drafts out and judges the
    // moment one becomes a booking.
    const where = sent.slice(sent.indexOf("ADD CONSTRAINT"));
    expect(where).toContain("status NOT IN ('draft', 'cancelled')");
    expect(where).toContain("staff_id IS NOT NULL");
    const holds = read("app/lib/bookings/holds-slot.ts");
    expect(holds).toContain('booking.status === "cancelled"');
    expect(holds).toContain('booking.status !== "draft"');
  });

  test("the data already there is looked at first, and a clash stops it by name", () => {
    expect(sent.indexOf("RAISE EXCEPTION")).toBeGreaterThan(-1);
    expect(sent.indexOf("RAISE EXCEPTION")).toBeLessThan(
      sent.indexOf("ADD CONSTRAINT"),
    );
    // History before the guard is not judged: the one pair that overlaps
    // today is in September 2026.
    expect((sent.match(/DATE '2026-11-24'/g) ?? []).length).toBe(3);
  });
});
