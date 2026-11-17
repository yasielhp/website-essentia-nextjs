import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Next runs a page's server actions one at a time, in call order, so a slow
 * consent action would hold up every action called after it. These pin where
 * `saveDetailsStep` calls the consent writes: after the draft's own writes, and
 * without waiting for them. Read from the source because the function needs a
 * browser, a session and the database to run.
 */
const SOURCE = readFileSync(join(import.meta.dir, "booking-submit.ts"), "utf8");
const start = SOURCE.indexOf("export async function saveDetailsStep");
const BODY = SOURCE.slice(
  start,
  SOURCE.indexOf("export async function saveDatetimeStep"),
);

describe("saveDetailsStep and the consent writes", () => {
  test("they are called once, and not awaited", () => {
    expect(BODY.match(/writeBookingConsentsWithin\(/g)).toHaveLength(1);
    expect(BODY).toMatch(/\bvoid writeBookingConsentsWithin\(/);
    expect(BODY).not.toMatch(/await writeBookingConsentsWithin\(/);
  });

  test("they come after every write of the draft, so no consent action queues ahead of one", () => {
    const consent = BODY.indexOf("writeBookingConsentsWithin(");
    for (const draftWrite of [
      "updateDraftBookingDetails(",
      '"create_draft_booking"',
      "updateDraftBookingMeta(",
    ]) {
      expect(BODY.indexOf(draftWrite)).toBeGreaterThan(-1);
      expect(BODY.indexOf(draftWrite)).toBeLessThan(consent);
    }
  });

  test("they run just before the result is returned", () => {
    const consent = BODY.indexOf("writeBookingConsentsWithin(");
    const result = BODY.indexOf('return { kind: "saved"');
    expect(result).toBeGreaterThan(consent);
    expect(BODY.slice(consent, result)).not.toMatch(/\bawait\b/);
  });
});
