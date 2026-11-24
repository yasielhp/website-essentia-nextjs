import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { UNLAUNCHED_ROUTES } from "@/constants/unlaunched";
import {
  facialTreatments,
  ivProtocols,
  manualTherapyTreatments,
} from "@/data/services-data";
import { buildLlmsFullTxt, buildLlmsTxt, llmsFamilies } from "@/lib/llms";

/**
 * The files for assistants are built from the site's own data, and these keep
 * them that way: the two files in `public/` must be exactly what the builder
 * writes, and what it writes must be what the site offers today, with no price
 * and nothing of the centre's past.
 */

const PUBLIC = join(import.meta.dir, "../../public");
const brief = readFileSync(join(PUBLIC, "llms.txt"), "utf8");
const full = readFileSync(join(PUBLIC, "llms-full.txt"), "utf8");
const BOTH = { "llms.txt": brief, "llms-full.txt": full };

describe("public/llms.txt and public/llms-full.txt", () => {
  test("are what the builder writes: run `bun run build:llms` if this fails", () => {
    expect(brief).toBe(buildLlmsTxt());
    expect(full).toBe(buildLlmsFullTxt());
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
