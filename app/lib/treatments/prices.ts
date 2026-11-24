import { sameTreatment } from "@/lib/treatments/match";
import type { SupportedLocale } from "@/utils/format";

/**
 * What a treatment costs, for the cards of the public site.
 *
 * The price is the session type's (`service_tiers`), never a figure written in
 * code or in a translation: the centre changes its prices itself from the
 * dashboard, and a figure typed here goes on saying the old one. It is the same
 * row the booking form reads, so a card and the form it leads to cannot
 * disagree. Pure: the read is `listPublicTierPrices`.
 */

/** One session type on sale and what it costs. */
export type TierPrice = { label: string; priceEur: number };

const asAmount = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

/**
 * The rows of `service_tiers` as prices to show.
 *
 * The centre's price, falling back to the web one: the same choice the booking
 * form makes for the list a visitor picks her session from, which is the next
 * price she sees after pressing "book" on a card. A row with no name cannot be
 * tied to a treatment and one with no price has nothing to say, so both are
 * left out. The rows come from the database and are checked, not trusted.
 */
export function toTierPrices(rows: unknown): TierPrice[] {
  if (!Array.isArray(rows)) return [];
  const prices: TierPrice[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const { label, price_eur, price_center_eur } = row as Record<
      string,
      unknown
    >;
    if (typeof label !== "string" || label.trim() === "") continue;
    const priceEur = asAmount(price_center_eur) ?? asAmount(price_eur);
    if (priceEur === null) continue;
    prices.push({ label, priceEur });
  }
  return prices;
}

/**
 * The prices of one treatment: those of the session types that carry its name,
 * which is how a tier meets its treatment (`sameTreatment`). Usually one. A
 * treatment sold in several lengths has several, each shown once and in the
 * order they were read. None means it is not on sale, and its card shows no
 * price at all rather than an old one.
 */
export function pricesOfTreatment(
  prices: readonly TierPrice[],
  title: string,
): number[] {
  const found: number[] = [];
  for (const price of prices) {
    if (!sameTreatment(price.label, title)) continue;
    if (!found.includes(price.priceEur)) found.push(price.priceEur);
  }
  return found;
}

/**
 * A price as a card writes it: `70 €` in Spanish and `€70` in English, with no
 * decimals when there are none to show (`72,50 €` when there are). The facial
 * cards write theirs the same way.
 */
export function cardPrice(amount: number, locale: SupportedLocale): string {
  const digits = Number.isInteger(amount) ? 0 : 2;
  return new Intl.NumberFormat(locale === "es" ? "es-ES" : "en-GB", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
}
