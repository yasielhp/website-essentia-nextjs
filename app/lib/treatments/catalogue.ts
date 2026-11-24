import {
  bookableServices,
  manualTherapyTreatments,
} from "@/data/services-data";
import { priceText, type TierPrice } from "@/lib/treatments/prices";
import type { SupportedLocale } from "@/utils/format";

/**
 * What Essentia offers, as the two agent tools list it: `list_services` of the
 * MCP server and `essentia_list_services` of WebMCP. One list, so an assistant
 * is told the same thing whichever door it came through.
 *
 * Pure: the prices are handed in. They are the session types' (`service_tiers`),
 * the ones the booking form shows and charges. The code used to carry its own
 * (at the centre and in the suite, from an old price list), and an assistant
 * went on quoting them after the centre had changed its prices.
 */

export type CatalogueEntry = {
  id: string;
  category: string;
  title: string;
  description: string;
  durations: string[];
  /**
   * What it costs at the centre, as text. Absent when the treatment has no
   * session type on sale: no price is told, rather than an old one.
   */
  priceCenter?: string;
};

/**
 * The services, then each manual therapy with the price of its session type,
 * less the ones whose session type is switched off (`hidden`, the ids from
 * `listHiddenTreatments`): the site has no page for them while they are off,
 * so an assistant is not told of them either.
 */
export function serviceCatalogue(
  prices: readonly TierPrice[],
  locale: SupportedLocale,
  hidden: readonly string[] = [],
): CatalogueEntry[] {
  return [
    ...bookableServices.map((service) => ({
      id: service.id,
      category: service.category,
      title: service.title,
      description: service.description,
      durations: service.durations,
    })),
    ...manualTherapyTreatments
      .filter((treatment) => !hidden.includes(treatment.id))
      .map((treatment) => {
        const price = priceText(
          prices,
          treatment.title,
          treatment.durations,
          locale,
        );
        return {
          id: `manual-therapies:${treatment.id}`,
          category: "wellness",
          title: treatment.title,
          description: treatment.description,
          durations: treatment.durations,
          ...(price ? { priceCenter: price } : {}),
        };
      }),
  ];
}

/** The same list as the text the MCP tool answers with. */
export function catalogueText(entries: readonly CatalogueEntry[]): string {
  return entries
    .map((entry) =>
      [
        `**${entry.title}** (${entry.category}) — ID: ${entry.id}`,
        `Duration: ${entry.durations.join(", ")}`,
        entry.priceCenter ? `Price: ${entry.priceCenter} (at centre)` : "",
        entry.description,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n---\n\n");
}
