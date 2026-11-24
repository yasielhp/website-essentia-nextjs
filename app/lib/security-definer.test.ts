import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The functions that change accounts run as their owner (SECURITY DEFINER)
 * and check nobody: only EXECUTE holds them back. Read from the migration that
 * takes it from the browser roles, and from the one caller in the code.
 */
const ROOT = join(import.meta.dir, "..", "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const FILE = "insforge/migrations/20261124_revoke_admin_account_functions.sql";

describe("the account functions are the service key's alone", () => {
  const text = read(FILE);
  // What CLAUDE.md's command sends: comments and BEGIN/COMMIT stripped.
  const sent = text
    .split("\n")
    .filter((line) => !line.startsWith("--") && !/^(BEGIN|COMMIT);$/.test(line))
    .join("\n");

  test("the file says it is not applied, and what is sent does not open with a comment", () => {
    expect(text.startsWith("-- NOT APPLIED.")).toBe(true);
    expect(sent.trimStart().startsWith("--")).toBe(false);
  });

  test("the three lose EXECUTE for PUBLIC, anon and authenticated, and nothing is granted", () => {
    const statement = sent.replace(/\s+/g, " ");
    expect(statement).toContain(
      "REVOKE EXECUTE ON FUNCTION public.admin_set_user_password(uuid, text), public.admin_update_user_email(uuid, text), public.admin_verify_email(text) FROM PUBLIC, anon, authenticated;",
    );
    expect(sent).not.toMatch(/\bGRANT\b/);
  });

  test("the one caller in the code reaches it with the service key, after checking who asks", () => {
    const source = read("app/actions/set-user-password.ts");
    expect(source).toContain(
      'getAdminClient().database.rpc(\n    "admin_set_user_password"',
    );
    expect(source).toContain("caller = await authenticate(accessToken)");
    expect(source).toContain('caller.role !== "admin"');
  });

  test("the old migration no longer claims it had been revoked", () => {
    expect(
      read("insforge/migrations/20260905b_campaigns_lock_down.sql"),
    ).toContain("Corrected 2026-11-24");
  });
});
