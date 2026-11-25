import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";

/**
 * The SECURITY DEFINER functions the browser's roles could call, read from the
 * SOURCE: nothing on the browser's side calls a function of the database at
 * all, and each of these is called only by the server modules named here,
 * each with the service key.
 *
 * The browser's side is every `"use client"` module, everything it imports
 * (followed through the project's own imports, type-only imports aside, up to
 * a `"use server"` module, of which the browser only gets a reference), and
 * every module that holds the browser's client (`@/lib/insforge`).
 *
 * THIS IS A REMINDER, NOT THE BARRIER. Being text, it cannot see a function
 * name put together at run time (`session-types.test.ts` refuses those). The
 * barrier is `insforge/migrations/20261124_revoke_public_definer_functions.sql`
 * (read below), and `20261124_bookings_close_browser_writes.sql` for the
 * booking functions.
 */

const ROOT = join(import.meta.dir, "..", "..");
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
const known = new Set(all);
const cache = new Map<string, string>();
const read = (path: string) => {
  if (!cache.has(path)) cache.set(path, readFileSync(join(ROOT, path), "utf8"));
  return cache.get(path)!;
};

/** The project's import aliases (`tsconfig.json`). */
const ALIASES: [string, string][] = [
  ["@/", "app/"],
  ["@components/", "app/components/"],
  ["@data/", "app/data/"],
  ["@lib/", "app/lib/"],
  ["@sections/", "app/components/sections/"],
];

/** The module an import names, when it is one of the project's own. */
function resolve(from: string, spec: string): string | null {
  let base: string | null = null;
  if (spec.startsWith(".")) base = normalize(join(dirname(from), spec));
  else {
    const alias = ALIASES.find(([prefix]) => spec.startsWith(prefix));
    if (alias) base = alias[1] + spec.slice(alias[0].length);
  }
  if (base === null) return null;
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
  ]) {
    if (known.has(candidate)) return candidate;
  }
  return null;
}

/**
 * What a module brings in with it: `import … from`, `export … from`, a bare
 * `import "…"` and `import("…")`. An `import type` or `export type` is erased
 * by the compiler and brings nothing.
 */
const IMPORTS =
  /(?:^|[\s;])(?:import|export)\s+(type\s+)?(?:[^'";]*?\sfrom\s*)?["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g;
function importsOf(path: string): string[] {
  const out: string[] = [];
  for (const m of read(path).matchAll(IMPORTS)) {
    if (m[1]) continue;
    const target = resolve(path, m[2] ?? m[3]!);
    if (target) out.push(target);
  }
  return out;
}

const directive = (source: string, name: string) =>
  new RegExp(`^\\s*["']use ${name}["']`, "m").test(source);
/** The client the browser holds (the public key, or a user's session). */
const BROWSER_CLIENT = /from\s+["']@\/?lib\/insforge(-public)?["']/;

/** The browser's side, as described above. */
function browserSide(): Set<string> {
  const seen = new Set<string>();
  const queue = all.filter((path) => {
    const source = read(path);
    return directive(source, "client") || BROWSER_CLIENT.test(source);
  });
  while (queue.length > 0) {
    const path = queue.pop()!;
    if (seen.has(path)) continue;
    seen.add(path);
    for (const next of importsOf(path)) {
      if (!seen.has(next) && !directive(read(next), "server")) queue.push(next);
    }
  }
  return seen;
}
const browser = browserSide();

/** `.rpc(`, `.rpc (` or `.rpc<T>(`: a call of a function of the database. */
const RPC_CALL = /\.rpc\s*(<[^>]*>)?\s*\(/;
/** The same call, with that function's name in quotes as its first argument. */
const calls = (fn: string) =>
  new RegExp(`\\.rpc\\s*(?:<[^>]*>)?\\s*\\(\\s*["'\`]${fn}["'\`]`);
/**
 * `rpc` reached another way, which the two above cannot see: taken out of the
 * client (`const { rpc } = db`), by its name in brackets (`db["rpc"]`), or
 * passed around without being called (`db.rpc.bind(db)`, `const f = db.rpc`).
 */
const RPC_ALIAS =
  /\{[^}]*\brpc\b[^}]*\}\s*=|\[\s*["'`]rpc["'`]\s*\]|\.rpc\b(?!\s*(?:<[^>]*>)?\s*\()/;
/** The test helpers that keep a list of the calls they were asked (`calls.rpc`). */
const FAKES = ["app/lib/whatsapp/fake-contacts-db.ts"];

/**
 * Every SECURITY DEFINER function of `public` that `anon` and `authenticated`
 * could execute on 2026-11-24, and the modules allowed to call each one.
 * A new caller fails here until it has been read: it must run on the server,
 * with the service key, and check what it is given.
 */
const CALLERS: Record<string, string[]> = {
  check_email_role: ["app/lib/contacts/public-contact.ts"],
  // The team's way only (admin and staff at the desk, the agents' tool):
  // every public path writes its contact without it (`writeContact`).
  upsert_contact: [
    "app/lib/bookings/for-staff.ts",
    "app/lib/contacts/write-contact.ts",
  ],
  promote_contact_to_client: [
    "app/lib/bookings/notify.ts",
    "app/lib/bookings/public-booking.ts",
    "app/services/bonus-payments.service.ts",
    "app/services/booking-payments.service.ts",
  ],
  register_for_education: ["app/lib/contacts/event-registration.ts"],
  register_for_race: ["app/lib/contacts/event-registration.ts"],
  // The policies' and the trigger's: no caller in the code.
  get_user_role: [],
  profiles_guard_role: [],
  // The public form's old booking functions (the other migration).
  create_draft_booking: [],
  update_booking_datetime: [],
  confirm_booking: [],
};

describe("the browser's side reaches no function of the database", () => {
  test("it is every client module and what it imports, the server's actions aside", () => {
    expect(all.some((path) => path.includes(".test."))).toBe(false);
    expect(all.length).toBeGreaterThan(500);
    expect(browser.size).toBeGreaterThan(300);
    for (const path of [
      // "use client"
      "app/components/sections/booking/booking-submit.ts",
      "app/components/sections/experiences/run-register-section.tsx",
      "app/components/sections/experiences/education-register-section.tsx",
      "app/(dashboard)/dashboard/bookings/new/page.tsx",
      // Imported by one, with no directive of its own.
      "app/(dashboard)/dashboard/bookings/new/create-booking.ts",
      "app/components/sections/booking/booking-consent.ts",
    ]) {
      expect({ path, browser: browser.has(path) }).toEqual({
        path,
        browser: true,
      });
    }
    for (const path of [
      // The doors: the browser gets a reference, not the module.
      "app/actions/public-contact.ts",
      "app/actions/event-registration.ts",
      "app/actions/desk-booking.ts",
      "app/actions/public-booking.ts",
      // And what is behind them.
      "app/lib/contacts/public-contact.ts",
      "app/lib/contacts/event-registration.ts",
      "app/lib/bookings/desk-contact.ts",
      "app/lib/bookings/public-booking.ts",
      "app/lib/insforge-admin.ts",
    ]) {
      expect({ path, browser: browser.has(path) }).toEqual({
        path,
        browser: false,
      });
    }
    // The check itself: what an import brings, and what it does not.
    expect(
      [
        ...'import { a } from "./x";\nimport type { B } from "@/lib/y";\nexport { c } from "@lib/z";\nimport "./side";\nconst m = import("@/w");'.matchAll(
          IMPORTS,
        ),
      ].map((m) => (m[1] ? null : (m[2] ?? m[3]))),
    ).toEqual(["./x", null, "@lib/z", "./side", "@/w"]);
  });

  test("no module on the browser's side calls a function of the database, of any name", () => {
    expect([...browser].filter((path) => RPC_CALL.test(read(path)))).toEqual(
      [],
    );
  });

  test("no module reaches `rpc` another way, so every call is one the checks can read", () => {
    expect(
      all.filter((path) => !FAKES.includes(path) && RPC_ALIAS.test(read(path))),
    ).toEqual([]);
    // The fakes are the tests' and nothing on the browser's side imports one.
    for (const path of FAKES) expect(browser.has(path)).toBe(false);
    // The checks themselves.
    for (const code of [
      "db.rpc(",
      "db.rpc (",
      "db.rpc<string>(",
      "db\n  .rpc(",
    ]) {
      expect({ code, call: RPC_CALL.test(code) }).toEqual({ code, call: true });
    }
    for (const code of [
      "const { rpc } = db;",
      "const { from, rpc: call } = client.database;",
      'db["rpc"]("upsert_contact")',
      "const f = db.rpc;",
      "db.rpc.bind(db)",
    ]) {
      expect({ code, alias: RPC_ALIAS.test(code) }).toEqual({
        code,
        alias: true,
      });
    }
    for (const code of ["db.rpc(", "db.rpc<string>(", "db.from(x)"]) {
      expect({ code, alias: RPC_ALIAS.test(code) }).toEqual({
        code,
        alias: false,
      });
    }
    expect(
      calls("upsert_contact").test('db.rpc<string>(\n  "upsert_contact",'),
    ).toBe(true);
  });

  test("each of the functions is called only by the server modules named, each with the service key", () => {
    for (const [fn, allowed] of Object.entries(CALLERS)) {
      const callers = all.filter((path) => calls(fn).test(read(path)));
      expect({ fn, callers }).toEqual({ fn, callers: allowed });
      for (const path of callers) {
        const source = read(path);
        expect({
          path,
          browser: browser.has(path),
          serviceKey: source.includes("getAdminClient"),
        }).toEqual({ path, browser: false, serviceKey: true });
      }
    }
    expect(calls("upsert_contact").test('db.rpc(\n  "upsert_contact",')).toBe(
      true,
    );
  });
});

describe("the doors that call them instead of the browser", () => {
  /** Every `export` that is not `export async function`, `export default` included. */
  const NOT_ASYNC_EXPORT = /^\s*export\s+(?!async\s+function\b)/m;
  const door = (path: string) => {
    const source = read(path);
    return {
      server: directive(source, "server"),
      // A "use server" module may only export async functions.
      onlyAsyncFunctions: !NOT_ASYNC_EXPORT.test(source),
    };
  };

  test("each is a server action that exports only async functions", () => {
    // The check itself.
    for (const code of [
      "export function f() {}",
      "export default async function f() {}",
      "export default f;",
      "export const f = async () => {};",
      "export type T = string;",
      "export { f };",
      "export * from './x';",
      "  export interface I {}",
    ]) {
      expect({ code, refused: NOT_ASYNC_EXPORT.test(code) }).toEqual({
        code,
        refused: true,
      });
    }
    expect(NOT_ASYNC_EXPORT.test("export async function f() {}")).toBe(false);
    for (const path of [
      "app/actions/public-contact.ts",
      "app/actions/event-registration.ts",
      "app/actions/desk-booking.ts",
    ]) {
      expect({ path, ...door(path) }).toEqual({
        path,
        server: true,
        onlyAsyncFunctions: true,
      });
    }
  });

  test("what they take is a strict object, and who asks is checked where it matters", () => {
    const contact = read("app/lib/contacts/public-contact.ts");
    const writer = read("app/lib/contacts/write-contact.ts");
    const deskCore = read("app/lib/bookings/desk-contact.ts");
    const registration = read("app/lib/contacts/event-registration.ts");
    const desk = read("app/actions/desk-booking.ts");
    expect({
      contactStrict: contact.includes("z.strictObject("),
      contactNeverSendsTheNoticeConsent: writer.includes("p_whatsapp: null,"),
      // The public paths write the public way; only admin and staff overwrite.
      contactPublicWay: contact.includes('"public",'),
      deskOverwritesOnlyForTheTeam:
        deskCore.includes('new Set(["admin", "staff"])') &&
        deskCore.includes('OVERWRITES.has(actor.role) ? "overwrite" : "link"'),
      registrationStrict: (registration.match(/z\.strictObject\(/g) ?? [])
        .length,
      // Her own account unless the team names another.
      ownAccount: registration.includes("input.userId ?? actor.userId"),
      teamOnly: registration.includes('new Set(["admin", "staff"])'),
      deskTeam: /linkDeskContact[\s\S]*?requireRole\(accessToken\)/.test(desk),
    }).toEqual({
      contactStrict: true,
      contactNeverSendsTheNoticeConsent: true,
      contactPublicWay: true,
      deskOverwritesOnlyForTheTeam: true,
      registrationStrict: 2,
      ownAccount: true,
      teamOnly: true,
      deskTeam: true,
    });
  });

  test("the pages go through them", () => {
    const form = read("app/components/sections/booking/booking-submit.ts");
    const race = read(
      "app/components/sections/experiences/run-register-section.tsx",
    );
    const course = read(
      "app/components/sections/experiences/education-register-section.tsx",
    );
    const desk = read(
      "app/(dashboard)/dashboard/bookings/new/create-booking.ts",
    );
    expect({
      form: form.includes("savePublicContact("),
      raceGuest: race.includes("registerGuestForEvent("),
      raceAccount: race.includes("registerAccountForEvent(getAccessToken()"),
      courseGuest: course.includes("registerGuestForEvent("),
      courseAccount: course.includes(
        "registerAccountForEvent(getAccessToken()",
      ),
      desk: desk.includes("linkDeskContact(getAccessToken()"),
    }).toEqual({
      form: true,
      raceGuest: true,
      raceAccount: true,
      courseGuest: true,
      courseAccount: true,
      desk: true,
    });
  });
});

describe("the migration that takes them from the browser's roles", () => {
  const file = "20261124_revoke_public_definer_functions.sql";
  const text = readFileSync(join(ROOT, "insforge", "migrations", file), "utf8");
  // What CLAUDE.md's command sends: comments and BEGIN/COMMIT stripped.
  const sent = text
    .split("\n")
    .filter((line) => !line.startsWith("--") && !/^(BEGIN|COMMIT);$/.test(line))
    .join("\n");

  test("it says when it was applied, and what is sent does not open with a comment", () => {
    expect(
      text.startsWith("-- APPLIED to the live database on 2026-11-25"),
    ).toBe(true);
    expect(sent.trimStart().startsWith("--")).toBe(false);
    expect(/^BEGIN;$/m.test(text) && /^COMMIT;$/m.test(text)).toBe(true);
  });

  test("the six lose EXECUTE for PUBLIC, anon and authenticated, by their exact signature", () => {
    for (const signature of [
      "check_email_role(text)",
      "upsert_contact(text, text, text, text, text, text, boolean, boolean, boolean)",
      "promote_contact_to_client(uuid)",
      "register_for_education(uuid, uuid, uuid)",
      "register_for_race(uuid, uuid, uuid)",
      "profiles_guard_role()",
    ]) {
      expect(sent).toContain(
        `REVOKE EXECUTE ON FUNCTION public.${signature} FROM PUBLIC, anon, authenticated;`,
      );
    }
  });

  test("get_user_role keeps its signature for the policies, answers only the caller's own role, and only authenticated keeps it", () => {
    expect(sent).toContain(
      "CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)",
    );
    expect(sent).toMatch(
      /STABLE SECURITY DEFINER\s+SET search_path TO 'public'/,
    );
    expect(sent).toContain(
      "SELECT role FROM profiles WHERE id = user_id AND id = auth.uid();",
    );
    expect(sent).toContain(
      "REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;",
    );
    // The one grant of the file.
    expect(sent.match(/\bGRANT\b[^;]*;/g)).toEqual([
      "GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;",
    ]);
  });

  test("every policy that calls get_user_role passes the caller, for authenticated, so the narrower answer changes none", () => {
    for (const other of [
      "20261124_bookings_close_browser_writes.sql",
      "20261124_service_tiers_and_settings_rls.sql",
    ]) {
      const policies = [
        ...readFileSync(join(ROOT, "insforge", "migrations", other), "utf8")
          .split("\n")
          .filter((line) => !line.startsWith("--"))
          .join("\n")
          .matchAll(/CREATE POLICY[\s\S]*?;/g),
      ]
        .map((m) => m[0])
        .filter((policy) => policy.includes("get_user_role"));
      expect(policies.length).toBeGreaterThan(0);
      for (const policy of policies) {
        expect(policy).toMatch(/\bTO authenticated\b/);
        // Every call of it in the policy is with the caller's own id.
        const uses = policy.match(/get_user_role\(/g)?.length ?? 0;
        const withCaller =
          policy.match(/get_user_role\(auth\.uid\(\)\)/g)?.length ?? 0;
        expect(withCaller).toBe(uses);
      }
    }
  });

  test("the booking functions are left to their own migration, not revoked twice", () => {
    for (const fn of [
      "create_draft_booking",
      "update_booking_datetime",
      "confirm_booking",
    ]) {
      expect(sent).not.toContain(fn);
    }
  });
});
