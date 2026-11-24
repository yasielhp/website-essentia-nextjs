import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import enMedicine from "../../messages/en/medicine.json";
import en from "../../messages/en/wellness.json";
import esMedicine from "../../messages/es/medicine.json";
import es from "../../messages/es/wellness.json";
import { manualTherapyTreatments } from "@/data/services-data";
import {
  META_DESCRIPTION_MAX,
  META_TITLE_MAX,
  treatmentMetaTitle,
} from "@/lib/seo";

describe("treatmentMetaTitle", () => {
  test("a name that fits carries the family it belongs to", () => {
    expect(treatmentMetaTitle("Espira", "Terapias Manuales · Essentia")).toBe(
      "Espira | Terapias Manuales · Essentia",
    );
  });

  test("a name too long for both is the title on its own, not one cut off", () => {
    const name = "Drenaje Linfático Integrativo — Método Essentia";
    expect(treatmentMetaTitle(name, "Terapias Manuales · Essentia")).toBe(name);
  });

  test("exactly at the limit still fits", () => {
    const suffix = "Essentia";
    const name = "x".repeat(META_TITLE_MAX - ` | ${suffix}`.length);
    expect(treatmentMetaTitle(name, suffix)).toHaveLength(META_TITLE_MAX);
    expect(treatmentMetaTitle(`${name}x`, suffix)).toBe(`${name}x`);
  });

  test("no manual therapy page has a title past the limit, in either language", () => {
    for (const messages of [es, en]) {
      const cards = messages.treatments.manualTherapiesCards as Record<
        string,
        { title: string }
      >;
      for (const treatment of manualTherapyTreatments) {
        const title = treatmentMetaTitle(
          cards[treatment.id]!.title,
          messages.treatments.manualTherapyMetaSuffix,
        );
        expect(`${title}: ${title.length <= META_TITLE_MAX}`).toBe(
          `${title}: true`,
        );
      }
    }
  });
});

describe("the description of a treatment's page, as a search result shows it", () => {
  // A card's description is written for the card, and some run past what a
  // search result shows. Those carry a shorter one of their own
  // (`metaDescription`) for the page's metadata; the card keeps its text.
  type Card = { title: string; description: string; metaDescription?: string };
  const families = (wellness: typeof es, medicine: typeof esMedicine) => ({
    manual: {
      cards: wellness.treatments.manualTherapiesCards as Record<string, Card>,
      suffix: wellness.treatments.manualTherapyMetaSuffix,
    },
    facial: {
      cards: wellness.treatments.facialCards as Record<string, Card>,
      suffix: wellness.treatments.facialMetaSuffix,
    },
    iv: {
      cards: medicine.iv.protocols as Record<string, Card>,
      suffix: medicine.iv.metaSuffix,
    },
  });
  const LANGUAGES = {
    es: families(es, esMedicine),
    en: families(en, enMedicine),
  };

  test("none is longer than a search result shows, in either language", () => {
    expect(META_DESCRIPTION_MAX).toBe(155);
    const long: string[] = [];
    for (const [language, byFamily] of Object.entries(LANGUAGES)) {
      for (const [family, { cards }] of Object.entries(byFamily)) {
        for (const [id, card] of Object.entries(cards)) {
          const shown = card.metaDescription ?? card.description;
          if (shown.length > META_DESCRIPTION_MAX) {
            long.push(`${language} ${family} ${id}: ${shown.length}`);
          }
        }
      }
    }
    expect(long).toEqual([]);
  });

  test("and no title is longer than its limit either", () => {
    const long: string[] = [];
    for (const [language, byFamily] of Object.entries(LANGUAGES)) {
      for (const [family, { cards, suffix }] of Object.entries(byFamily)) {
        for (const [id, card] of Object.entries(cards)) {
          const title =
            family === "manual"
              ? treatmentMetaTitle(card.title, suffix)
              : `${card.title} | ${suffix}`;
          if (title.length > META_TITLE_MAX) {
            long.push(`${language} ${family} ${id}: ${title.length}`);
          }
        }
      }
    }
    expect(long).toEqual([]);
  });

  test("a shorter one is written only where the card's own does not fit in one of the two languages", () => {
    for (const family of ["manual", "facial", "iv"] as const) {
      const esCards = LANGUAGES.es[family].cards;
      const enCards = LANGUAGES.en[family].cards;
      for (const id of Object.keys(esCards)) {
        const needed =
          esCards[id]!.description.length > META_DESCRIPTION_MAX ||
          enCards[id]!.description.length > META_DESCRIPTION_MAX;
        // Same keys in both languages: where one needs it, both carry it.
        expect(`${family} ${id}: ${"metaDescription" in esCards[id]!}`).toBe(
          `${family} ${id}: ${needed}`,
        );
        expect(`${family} ${id}: ${"metaDescription" in enCards[id]!}`).toBe(
          `${family} ${id}: ${needed}`,
        );
      }
    }
  });

  test("the three pages read the shorter one first", () => {
    const pages = join(import.meta.dir, "../(site)/[locale]/(page)");
    for (const path of [
      "wellness/manual-therapies",
      "wellness/facial-therapies",
      "medicine/intravenous-therapy",
    ]) {
      const source = readFileSync(join(pages, path, "[slug]/page.tsx"), "utf8");
      const meta = source.indexOf(".metaDescription`)");
      const card = source.indexOf(".description`)");
      expect(`${path}: ${meta > -1 && meta < card}`).toBe(`${path}: true`);
    }
  });
});

describe("the home and Wellness pages say what the centre offers today", () => {
  const read = (path: string) =>
    JSON.parse(
      readFileSync(join(import.meta.dir, "../../messages", path), "utf8"),
    ) as { meta: { title: string; description: string } };
  const PAGES = {
    "es home": read("es/home.json").meta,
    "en home": read("en/home.json").meta,
    "es wellness": read("es/wellness.json").meta,
    "en wellness": read("en/wellness.json").meta,
  };
  /** What the owner listed on 2026-11-24 as not offered. */
  const NOT_OFFERED =
    /contrast|contraste|breath|respiraci|red light|luz roja|regenerat|exclusiv|hiperb|hyperb/i;

  test("within the limits, and naming the centre's address", () => {
    for (const [page, meta] of Object.entries(PAGES)) {
      expect(`${page}: ${meta.title.length <= META_TITLE_MAX}`).toBe(
        `${page}: true`,
      );
      expect(
        `${page}: ${meta.description.length <= META_DESCRIPTION_MAX}`,
      ).toBe(`${page}: true`);
      expect(meta.description).toContain("Rambla de Santa Cruz, 83");
      expect(meta.description).toContain("Santa Cruz de Tenerife");
    }
  });

  test("with nothing that is not offered", () => {
    for (const [page, meta] of Object.entries(PAGES)) {
      expect(`${page}: ${NOT_OFFERED.test(meta.description)}`).toBe(
        `${page}: false`,
      );
    }
  });

  test("and the schema.org of every page lists only what can be booked", () => {
    const layout = readFileSync(
      join(import.meta.dir, "../(site)/[locale]/layout.tsx"),
      "utf8",
    );
    const graph = layout.slice(
      layout.indexOf("function buildSchemaOrg"),
      layout.indexOf("export default"),
    );
    expect(graph).not.toMatch(
      /name: "[^"]*(Hyperbaric|Hiperb|Regenerat|Contrast|Contraste|Red Light|Luz Roja)/,
    );
    expect(graph).not.toMatch(
      /"(Regenerative Medicine|Medicina Regenerativa)"/,
    );
    for (const service of [
      "Manual Therapies",
      "Therapeutic Facials",
      "IV Therapy",
      "Terapias Manuales",
      "Faciales Terapéuticos",
      "Terapia IV",
    ]) {
      expect(graph).toContain(`name: "${service}"`);
    }
    const fallback = layout.slice(
      layout.indexOf("description:"),
      layout.indexOf("openGraph:"),
    );
    expect(fallback).not.toMatch(NOT_OFFERED);
  });
});
