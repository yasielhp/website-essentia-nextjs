import { unstable_cache } from "next/cache";
import { insforgePublic } from "@/lib/insforge-public";
import type { TierPrice } from "@/lib/treatments/prices";
import { readTierPrices } from "@/lib/treatments/read-prices";

/**
 * What the session types of one service cost, as the public site may show it.
 *
 * SERVER ONLY. It is what the treatment pages print on their cards (in the
 * HTML they are served with, so there is no price appearing after the page
 * does and a search engine reads it) and what the agent tools answer with.
 *
 * Kept for five minutes: the pages are prerendered, and a price the centre
 * changes from the dashboard is on the site within that time, with no deploy.
 * The pages that print these also declare the same `revalidate` themselves.
 */

/** Drop this tag (`revalidateTag`) to show a changed price at once. */
export const TIER_PRICES_CACHE_TAG = "tier-prices";

/** How long a read is kept. The pages' own `revalidate` repeats this figure. */
export const TIER_PRICES_REVALIDATE_SECONDS = 300;

// The anonymous client: these rows are the same for every visitor, and it is
// the read the booking form already makes from the browser.
const cachedTierPrices = unstable_cache(
  (serviceId: string) => readTierPrices(insforgePublic.database, serviceId),
  ["tier-prices"],
  { revalidate: TIER_PRICES_REVALIDATE_SECONDS, tags: [TIER_PRICES_CACHE_TAG] },
);

/**
 * Never throws. A read that fails is no prices: a card without its price is
 * still a card, and the page still renders. The failure is not kept (the read
 * throws inside the cache, so nothing is stored), and the next request asks
 * again.
 */
export async function listPublicTierPrices(
  serviceId: string,
): Promise<TierPrice[]> {
  try {
    return await cachedTierPrices(serviceId);
  } catch {
    return [];
  }
}
