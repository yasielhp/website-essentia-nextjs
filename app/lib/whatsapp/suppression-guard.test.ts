import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Nothing but an administrator, from the contact's card, may take a number off
 * the STOP list: no checkbox, toggle, contact upsert, migration or job. The
 * list is only worth anything if that holds, so it is pinned by reading the
 * code: who mentions the table, and who can delete from it.
 */

const ROOT = join(import.meta.dir, "../../..");

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) {
      continue;
    }
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sources(path, out);
    else if (/\.(ts|tsx|sql)$/.test(name)) out.push(path);
  }
  return out;
}

const files = [
  ...sources(join(ROOT, "app")),
  ...sources(join(ROOT, "insforge")),
]
  .filter((file) => !/\.test\.tsx?$/.test(file))
  .map((file) => ({
    file: relative(ROOT, file),
    text: readFileSync(file, "utf8"),
  }));

const mentions = (needle: RegExp) =>
  files
    .filter((f) => needle.test(f.text))
    .map((f) => f.file)
    .sort();

describe("the STOP list", () => {
  test("only these files query the table", () => {
    const query = /from\(\s*(?:SUPPRESSED_TABLE|"whatsapp_suppressed_phones")/;
    expect(mentions(query)).toEqual([
      "app/actions/contacts.ts",
      "app/lib/whatsapp/suppression.ts",
    ]);
  });

  test("only the contact card's action deletes from it", () => {
    const deleting = files
      .filter((f) =>
        /from\((?:SUPPRESSED_TABLE|"whatsapp_suppressed_phones")\)\s*\.delete\(/.test(
          f.text,
        ),
      )
      .map((f) => f.file);
    expect(deleting).toEqual(["app/actions/contacts.ts"]);
  });

  test("no migration or SQL function touches it besides its own", () => {
    const sql = files.filter(
      (f) =>
        f.file.endsWith(".sql") && /whatsapp_suppressed_phones/.test(f.text),
    );
    expect(sql.map((f) => f.file)).toEqual([
      "insforge/migrations/20261117l_whatsapp_suppressed_phones.sql",
    ]);
  });

  test("the reads that gate a send go through the module that fails closed", () => {
    // The transactional sender, the campaign sender and the audience use the
    // helpers, which throw when the list cannot be read.
    for (const file of [
      "app/lib/whatsapp/notify-client.ts",
      "app/lib/campaigns/dispatch-whatsapp.ts",
      "app/lib/campaigns/audience.ts",
    ]) {
      const text = files.find((f) => f.file === file)?.text ?? "";
      expect(text).toMatch(
        /isPhoneSuppressed|loadSuppressedPhones|loadAllSuppressedPhones/,
      );
    }
  });
});
