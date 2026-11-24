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

/**
 * The tag the site keeps these prices under (`listPublicTierPrices`). Dropping
 * it (`refreshTierPrices`) is what shows a changed price at once. Here, and not
 * beside the cached read, so the action that drops it does not load the
 * database client to learn a word.
 */
export const TIER_PRICES_CACHE_TAG = "tier-prices";

/** One session type on sale: its name, how long it lasts and what it costs. */
export type TierPrice = {
  label: string;
  /** Null when the session type has no length set. */
  durationMinutes: number | null;
  priceEur: number;
};

const asAmount = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

const asMinutes = (value: unknown): number | null => {
  const minutes = asAmount(value);
  return minutes !== null && Number.isInteger(minutes) ? minutes : null;
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
    const { label, duration_minutes, price_eur, price_center_eur } =
      row as Record<string, unknown>;
    if (typeof label !== "string" || label.trim() === "") continue;
    const priceEur = asAmount(price_center_eur) ?? asAmount(price_eur);
    if (priceEur === null) continue;
    prices.push({
      label,
      durationMinutes: asMinutes(duration_minutes),
      priceEur,
    });
  }
  return prices;
}

/**
 * The minutes a card's length states: `"30 min"` is 30. Anything that is not
 * one plain length (`"45–60 min"`, `"1 h"`) is null and is not guessed at: a
 * price tied to the wrong length is a wrong price.
 */
export function minutesOf(duration: string): number | null {
  const match = /^\s*(\d{1,4})\s*min\s*$/i.exec(duration);
  return match ? Number(match[1]) : null;
}

/**
 * The price that goes with one length of a treatment's card, or null.
 *
 * A session type is this treatment's when it carries its name, which is how a
 * tier meets its treatment (`sameTreatment`), AND lasts what the card says: a
 * treatment can be sold in two lengths, and the price of the 90 minutes is not
 * the price of the 60. `durationMinutes` null is a card that states no length:
 * then the name alone decides, as long as it has one price. With several the
 * card would have to say "from", which the site has no wording for, so it
 * shows none. Null means "show no price", never "show an old one".
 */
export function priceOf(
  prices: readonly TierPrice[],
  title: string,
  durationMinutes: number | null,
): number | null {
  const found = new Set<number>();
  for (const price of prices) {
    if (!sameTreatment(price.label, title)) continue;
    if (durationMinutes !== null && price.durationMinutes !== durationMinutes) {
      continue;
    }
    found.add(price.priceEur);
  }
  // Two rows with one name and one length that disagree are not a price.
  return found.size === 1 ? [...found][0]! : null;
}

/**
 * A price as a card writes it: `70 €` in Spanish and `€70` in English, with no
 * decimals when there are none to show (`72,50 €` when there are). It is how
 * the cards wrote their prices when these were typed by hand.
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

/**
 * The line under a card's title: each length the card shows, followed by its
 * price when there is one (`30 min · 70 €`).
 *
 * With no prices (they are read after the page opens, and the read can fail)
 * it is the lengths alone, which is the line the card had before it showed any
 * price: nothing appears or moves except the price itself.
 */
export function cardMeta(
  prices: readonly TierPrice[],
  title: string,
  durations: readonly string[],
  locale: SupportedLocale,
): string {
  if (durations.length === 0) {
    const price = priceOf(prices, title, null);
    return price === null ? "" : cardPrice(price, locale);
  }
  return durations
    .flatMap((duration) => {
      const minutes = minutesOf(duration);
      const price = minutes === null ? null : priceOf(prices, title, minutes);
      return price === null ? [duration] : [duration, cardPrice(price, locale)];
    })
    .join(" · ");
}

/**
 * The line of every card of a page, by treatment id, made on the SERVER and
 * handed to the cards as text.
 *
 * The cards are client components, rendered once on the server and again in
 * the browser. A price formatted on both sides would have to come out letter
 * for letter the same from two different engines (the space before the euro
 * sign is the locale's, and engines have changed theirs before), or React
 * throws the server's HTML away. Text made once cannot disagree with itself.
 *
 * Only the treatments that show a length get a line; one without (a ritual
 * whose card prints a line of its own) is left out.
 */
export function cardLines(
  treatments: readonly { id: string; title: string; durations?: string[] }[],
  prices: readonly TierPrice[],
  locale: SupportedLocale,
): Record<string, string> {
  const lines: Record<string, string> = {};
  for (const treatment of treatments) {
    if (!treatment.durations) continue;
    lines[treatment.id] = cardMeta(
      prices,
      treatment.title,
      treatment.durations,
      locale,
    );
  }
  return lines;
}

/**
 * What a treatment costs, in words, for a list an assistant reads: `€70`; with
 * several lengths, which price is whose (`60 min: €140, 90 min: €190`). Empty
 * when it has no price to tell, under the same rule as a card's (`priceOf`).
 */
export function priceText(
  prices: readonly TierPrice[],
  title: string,
  durations: readonly string[],
  locale: SupportedLocale,
): string {
  if (durations.length === 0) {
    const price = priceOf(prices, title, null);
    return price === null ? "" : cardPrice(price, locale);
  }
  const priced = durations.flatMap((duration) => {
    const minutes = minutesOf(duration);
    const price = minutes === null ? null : priceOf(prices, title, minutes);
    return price === null
      ? []
      : [{ duration, price: cardPrice(price, locale) }];
  });
  if (durations.length === 1) return priced[0]?.price ?? "";
  return priced.map((p) => `${p.duration}: ${p.price}`).join(", ");
}
