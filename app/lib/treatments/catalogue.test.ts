import { describe, expect, test } from "bun:test";
import { manualTherapyTreatments } from "@/data/services-data";
import { catalogueText, serviceCatalogue } from "@/lib/treatments/catalogue";

/**
 * What the two agent tools (`list_services` of the MCP server and
 * `essentia_list_services` of WebMCP) tell an assistant about the treatments.
 * The prices are the session types', read from the database: an assistant that
 * quotes a figure typed into the code quotes the one the centre has since
 * changed.
 */

const tier = (label: string, durationMinutes: number, priceEur: number) => ({
  label,
  durationMinutes,
  priceEur,
});

const PRICES = [tier("Espira", 30, 70), tier("Pulse", 45, 85)];
const plain = (text: string | undefined) => text?.replace(/ /g, " ");
const entry = (id: string, locale: "es" | "en" = "en") =>
  serviceCatalogue(PRICES, locale).find((e) => e.id === id);

describe("serviceCatalogue", () => {
  test("a treatment on sale carries the price of its session type", () => {
    expect(entry("manual-therapies:espira")).toMatchObject({
      title: "Espira",
      category: "wellness",
      durations: ["30 min"],
      priceCenter: "€70",
    });
    expect(plain(entry("manual-therapies:pulse", "es")?.priceCenter)).toBe(
      "85 €",
    );
  });

  test("a treatment with no session type on sale has no price at all, not an old one", () => {
    const alure = entry("manual-therapies:alure-duo");
    expect(alure?.title).toBe("Alure Duo");
    expect(alure && "priceCenter" in alure).toBe(false);
  });

  test("with no prices read, every treatment is listed and none is priced", () => {
    const entries = serviceCatalogue([], "en");
    expect(
      entries.filter((e) => e.id.startsWith("manual-therapies:")),
    ).toHaveLength(manualTherapyTreatments.length);
    expect(entries.some((e) => "priceCenter" in e)).toBe(false);
  });

  test("the services themselves come first, as they always did, without a price", () => {
    const first = serviceCatalogue(PRICES, "en")[0];
    expect(first?.id).toBe("manual-therapies");
    expect(first && "priceCenter" in first).toBe(false);
  });

  test("nothing in the list speaks of the suite any more", () => {
    expect(JSON.stringify(serviceCatalogue(PRICES, "en"))).not.toMatch(
      /suite/i,
    );
  });
});

describe("catalogueText: the list as the MCP tool answers it", () => {
  const body = catalogueText(serviceCatalogue(PRICES, "en"));
  const block = (title: string) =>
    body.split("\n\n---\n\n").find((b) => b.startsWith(`**${title}**`)) ?? "";

  test("a priced treatment says its price, at the centre", () => {
    expect(block("Espira")).toContain("ID: manual-therapies:espira");
    expect(block("Espira")).toContain("Duration: 30 min");
    expect(block("Espira")).toContain("Price: €70 (at centre)");
  });

  test("a treatment that is not on sale has no price line", () => {
    expect(block("Alure Duo")).toContain("Duration: 50 min");
    expect(block("Alure Duo")).not.toContain("Price:");
  });

  test("no figure from the old price list is left in it", () => {
    // Espira was 90 € at the centre and 120 € in the suite in the code.
    expect(body).not.toMatch(/90 €|120 €|in-suite/);
  });
});
