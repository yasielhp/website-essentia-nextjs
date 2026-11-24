import { describe, expect, test } from "bun:test";
import en from "../../messages/en/wellness.json";
import es from "../../messages/es/wellness.json";
import { manualTherapyTreatments } from "@/data/services-data";
import { META_TITLE_MAX, treatmentMetaTitle } from "@/lib/seo";

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
