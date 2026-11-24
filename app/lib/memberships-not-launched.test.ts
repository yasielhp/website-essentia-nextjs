import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import enExperiences from "../../messages/en/experiences.json";
import esExperiences from "../../messages/es/experiences.json";
import enMedicine from "../../messages/en/medicine.json";
import esMedicine from "../../messages/es/medicine.json";
import enWellness from "../../messages/en/wellness.json";
import esWellness from "../../messages/es/wellness.json";

/**
 * Memberships are not on sale (the owner, 2026-11-24): the site sells none,
 * sends nobody to them, and says nothing is included in one.
 */

const ROOT = join(import.meta.dir, "../..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const MEMBERSHIP = /membres[ií]a|membership/i;

describe("the closing calls of Wellness, Medicine and Experiences", () => {
  test("Wellness and Medicine close on booking a session, not on memberships", () => {
    for (const [path, href] of [
      ["app/components/sections/wellness/cta-section.tsx", '"/booking"'],
      [
        "app/components/sections/medicine/cta-section.tsx",
        '"/booking?service=intravenous-therapy"',
      ],
    ] as const) {
      const source = read(path);
      expect(source).not.toContain("/experiences/memberships");
      expect(source).toContain(`href=${href}`);
      expect(source).toContain('t("ctaBook")');
    }
  });

  test("and their copy names no membership, in either language", () => {
    for (const cta of [
      esWellness.cta,
      enWellness.cta,
      esMedicine.cta,
      enMedicine.cta,
    ]) {
      expect(Object.keys(cta).sort()).toEqual(
        ["body", "ctaBook", "ctaContact", "heading"].sort(),
      );
      expect(JSON.stringify(cta)).not.toMatch(MEMBERSHIP);
    }
  });

  test("Experiences has no closing call: nothing there can be booked yet", () => {
    expect(
      read("app/(site)/[locale]/(page)/experiences/page.tsx"),
    ).not.toContain("CtaSection");
    expect(
      existsSync(
        join(ROOT, "app/components/sections/experiences/cta-section.tsx"),
      ),
    ).toBe(false);
    expect("cta" in esExperiences).toBe(false);
    expect("cta" in enExperiences).toBe(false);
  });

  test("no button text that offers memberships is left behind", () => {
    expect("viewMemberships" in esWellness.treatments).toBe(false);
    expect("viewMemberships" in enWellness.treatments).toBe(false);
    expect("ctaLearn" in esExperiences.hero).toBe(false);
    expect("ctaLearn" in enExperiences.hero).toBe(false);
  });
});

describe("the Experiences page", () => {
  /** What would promise a club with members, which does not exist yet. */
  const MEMBERS =
    /miembro|\bmembers?\b|member dinners|red de personas|network of people|club privado|private club/i;

  test("its hero and its values speak of no members, private club or network that exists today", () => {
    for (const messages of [esExperiences, enExperiences]) {
      for (const block of [
        messages.hero.body,
        JSON.stringify(messages.values),
      ]) {
        expect(block).not.toMatch(MEMBERS);
      }
      expect(messages.hero.body).toMatch(/running/i);
      expect(messages.hero.body).toContain("Santa Cruz de Tenerife");
    }
    expect(esExperiences.hero.body).toMatch(/^Muy pronto/);
    expect(enExperiences.hero.body).toMatch(/^Coming soon/);
  });
});
