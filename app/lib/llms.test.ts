import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { contact } from "@/constants/contact";
import { UNLAUNCHED_ROUTES } from "@/constants/unlaunched";
import {
  facialTreatments,
  ivProtocols,
  manualTherapyTreatments,
} from "@/data/services-data";
import { buildLlmsFullTxt, buildLlmsTxt, llmsFamilies } from "@/lib/llms";
import {
  NOTHING_HIDDEN,
  type HiddenTreatments,
} from "@/lib/treatments/visibility";

/**
 * The files for assistants are built from the site's own data, and these keep
 * them that way: what the builder writes must be what the site offers today,
 * with no price, nothing of the centre's past, and no treatment whose session
 * type is switched off. They are served by two route handlers, which hand the
 * builder the treatments switched off at the time (`listAllHiddenTreatments`).
 */

const ROOT = join(import.meta.dir, "../..");
const brief = buildLlmsTxt();
const full = buildLlmsFullTxt();
const BOTH = { "llms.txt": brief, "llms-full.txt": full };

/** The session types switched off on 2026-11-24, as the read hands them over. */
const TODAY: HiddenTreatments = {
  "manual-therapies": ["alure-duo", "essentia-signature"],
  "facial-therapies": ["kinea-signature"],
  "intravenous-therapy": [],
};

describe("/llms.txt and /llms-full.txt", () => {
  test("are served by the route handlers, with the treatments switched off read at the time", () => {
    for (const name of ["llms.txt", "llms-full.txt"]) {
      // A file of the same name in `public/` would be served instead (or
      // refused by the build) and say what was true the day it was written.
      expect(`${name}: ${existsSync(join(ROOT, "public", name))}`).toBe(
        `${name}: false`,
      );
      const route = readFileSync(join(ROOT, "app", name, "route.ts"), "utf8");
      expect(route).toContain("await listAllHiddenTreatments()");
      expect(route).toContain("export const revalidate = 300;");
    }
  });

  test("leave out a treatment whose session type is switched off, in both files", () => {
    const hidden = {
      "llms.txt": buildLlmsTxt(TODAY),
      "llms-full.txt": buildLlmsFullTxt(TODAY),
    };
    for (const [name, text] of Object.entries(hidden)) {
      for (const page of [
        "/wellness/manual-therapies/alure-duo",
        "/wellness/manual-therapies/essentia-signature",
        "/wellness/facial-therapies/kinea-signature",
      ]) {
        expect(`${name} ${page}: ${text.includes(`.com${page}`)}`).toBe(
          `${name} ${page}: false`,
        );
      }
      expect(text).not.toMatch(/Alure Duo|Essentia Signature|Kinéa Signature/);
      expect(text).toContain(".com/wellness/manual-therapies/espira");
      expect(text).toContain(".com/wellness/facial-therapies/aurum");
    }
  });

  test("count only the treatments shown", () => {
    const shown = llmsFamilies(TODAY);
    expect(
      shown.find((f) => f.id === "manual-therapies")?.entries,
    ).toHaveLength(manualTherapyTreatments.length - 2);
    expect(
      shown.find((f) => f.id === "facial-therapies")?.entries,
    ).toHaveLength(facialTreatments.length - 1);
    expect(buildLlmsTxt(TODAY)).toContain(
      `${manualTherapyTreatments.length - 2} treatments, each with its own page.`,
    );
  });

  test("with nothing hidden (no read, or one that failed), every treatment is listed", () => {
    expect(buildLlmsTxt(NOTHING_HIDDEN)).toBe(brief);
    expect(buildLlmsFullTxt(NOTHING_HIDDEN)).toBe(full);
  });

  test("give no price: each treatment's own page has the current one", () => {
    for (const [name, text] of Object.entries(BOTH)) {
      expect(
        `${name}: ${/€|\beur\b|\beuros?\b|\d\s?\/\s?mo/i.test(text)}`,
      ).toBe(`${name}: false`);
      expect(text).toContain("Prices are not listed in this file");
    }
  });

  test("say nothing of where the centre used to be, or of a suite", () => {
    for (const [name, text] of Object.entries(BOTH)) {
      expect(`${name}: ${/baobab|suite|costa adeje|fañab/i.test(text)}`).toBe(
        `${name}: false`,
      );
    }
  });

  test("link no Facebook page: facebook.com/essentia is not the centre's", () => {
    for (const [name, text] of Object.entries(BOTH)) {
      expect(`${name}: ${/facebook/i.test(text)}`).toBe(`${name}: false`);
    }
    // The footer, the contact page and the schema.org `sameAs` list the same.
    expect(contact.socialMedia.map((s) => s.name)).toEqual(["Instagram"]);
  });

  test("give the centre's address as the site has it", () => {
    for (const text of Object.values(BOTH)) {
      expect(text).toContain(
        "Rambla de Santa Cruz, 83, 38004 Santa Cruz de Tenerife",
      );
    }
  });

  test("list nothing that is only announced: no page that says 'coming soon'", () => {
    for (const [name, text] of Object.entries(BOTH)) {
      for (const route of UNLAUNCHED_ROUTES) {
        expect(`${name} ${route}: ${text.includes(`.com${route}`)}`).toBe(
          `${name} ${route}: false`,
        );
      }
      expect(text).not.toMatch(/coming soon|not yet bookable/i);
    }
  });

  test("link every treatment of the three services to its own page, in both files", () => {
    const pages = [
      ...manualTherapyTreatments.map(
        (t) => `/wellness/manual-therapies/${t.id}`,
      ),
      ...facialTreatments.map((t) => `/wellness/facial-therapies/${t.id}`),
      ...ivProtocols.map((p) => `/medicine/intravenous-therapy/${p.id}`),
    ];
    expect(pages).toHaveLength(
      llmsFamilies().reduce((n, f) => n + f.entries.length, 0),
    );
    for (const text of Object.values(BOTH)) {
      for (const page of pages) expect(text).toContain(`.com${page}`);
    }
  });

  test("call each treatment by the name the site gives it today", () => {
    for (const text of Object.values(BOTH)) {
      expect(text).toContain(
        "Integrative Lymphatic Drainage — Essentia Method",
      );
      expect(text).not.toMatch(/brasile|avanzado|advanced lymphatic/i);
    }
  });

  test("every treatment says how long it lasts, or what the visit is", () => {
    for (const f of llmsFamilies()) {
      for (const entry of f.entries) {
        expect(`${entry.name}: ${entry.length.trim() !== ""}`).toBe(
          `${entry.name}: true`,
        );
        expect(entry.description.trim()).not.toBe("");
      }
    }
  });
});
