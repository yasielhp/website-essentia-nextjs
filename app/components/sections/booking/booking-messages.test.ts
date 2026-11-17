import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import en from "../../../../messages/en/booking.json";
import es from "../../../../messages/es/booking.json";

/**
 * The details step has two consent boxes and the texts around them. These
 * keep the two languages in step and keep a key from outliving the markup that
 * used it (the WhatsApp boxes' texts did, once the boxes were merged).
 */
const STEP = readFileSync(
  join(import.meta.dir, "steps", "details-step.tsx"),
  "utf8",
);
// The bonus checkout reads the same namespace for its own terms line.
const BONUS = readFileSync(
  join(import.meta.dir, "..", "bonus", "bonus-checkout.tsx"),
  "utf8",
);
const used = new Set([
  ...[...STEP.matchAll(/\bt\(\s*"([A-Za-z0-9_.]+)"/g)].map((m) => m[1]),
  ...[...BONUS.matchAll(/\btDetails\(\s*"([A-Za-z0-9_.]+)"/g)].map((m) => m[1]),
]);
const keys = (messages: typeof es) => Object.keys(messages.detailsStep).sort();

describe("booking.detailsStep messages", () => {
  test("Spanish and English have exactly the same keys", () => {
    expect(keys(es)).toEqual(keys(en));
  });

  test("every key is read by the details step, except the gender labels the hook reads", () => {
    const viaHook = new Set([
      "genderNotSpecified",
      "genderFemale",
      "genderMale",
      "genderOther",
    ]);
    // `notesPlaceholder` was already unused before the two consent boxes were
    // merged; it is not this test's business.
    viaHook.add("notesPlaceholder");
    const unused = keys(es).filter((k) => !used.has(k) && !viaHook.has(k));
    expect(unused).toEqual([]);
  });

  test("every key the step reads exists", () => {
    const missing = [...used].filter(
      (k) => !(k in es.detailsStep) && !k.includes("."),
    );
    expect(missing).toEqual([]);
  });

  test("the bonus checkout keeps its plain terms line: it books no appointment", () => {
    expect(es.detailsStep.consentSuffix).toBe(".");
    expect(en.detailsStep.consentSuffix).toBe(".");
    expect(BONUS).toContain('tDetails("consentSuffix")');
  });

  test("there is one box for news and offers and none for WhatsApp alone", () => {
    for (const messages of [es, en]) {
      expect(
        Object.keys(messages.detailsStep).filter((k) => /^whatsapp/i.test(k)),
      ).toEqual([]);
    }
    expect(STEP).toContain('name="newsletter"');
    expect(STEP).not.toContain('name="whatsapp');
  });

  test("the booking's consent line says the notices go by email and WhatsApp, in both languages", () => {
    expect(es.detailsStep.consentNoticeSuffix).toMatch(/email y WhatsApp/);
    expect(en.detailsStep.consentNoticeSuffix).toMatch(/email and WhatsApp/);
    expect(es.detailsStep.newsletterOptInHint).toMatch(/BAJA/);
    expect(en.detailsStep.newsletterOptInHint).toMatch(/STOP/);
  });
});
