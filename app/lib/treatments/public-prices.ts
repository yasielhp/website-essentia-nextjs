import { unstable_cache } from "next/cache";
import { insforgePublic } from "@/lib/insforge-public";
import { TIER_PRICES_CACHE_TAG, type TierPrice } from "@/lib/treatments/prices";
import {
  isBookableService,
  readTierPrices,
} from "@/lib/treatments/read-prices";

/**
 * What the session types of one service cost, as the public site may show it.
 *
 * SERVER ONLY. It is what the treatment pages print on their cards (in the
 * HTML they are served with, so there is no price appearing after the page
 * does and a search engine reads it) and what the agent tools answer with.
 *
 * Kept for five minutes: the pages are prerendered, and a price the centre
 * changes is on the site within that time, with no deploy. Saving a session
 * type in Settings does not wait for it: it drops the tag (`refreshTierPrices`),
 * and with it every prerendered page that printed these prices. The five
 * minutes are for a change made some other way (straight in the database).
 * The pages that print these also declare the same `revalidate` themselves.
 */

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
 * still a card, and the page still renders.
 *
 * What a failure costs depends on what was there before. The read throws
 * inside the cache, so "no prices" is never stored as the answer; with an
 * earlier answer kept, that one goes on being served. With none (the first
 * read after a deploy, or after the tag was dropped), the page is rendered
 * without prices, and a prerendered page is itself kept for its `revalidate`:
 * its cards can stay without a price for up to those 300 seconds, until the
 * page is rebuilt and the read is tried again.
 *
 * The service is checked BEFORE the cache is asked: the argument is part of
 * the cache key, so any other string would become an entry of its own.
 */
export async function listPublicTierPrices(
  serviceId: string,
): Promise<TierPrice[]> {
  if (!isBookableService(serviceId)) return [];
  try {
    return await cachedTierPrices(serviceId);
  } catch {
    return [];
  }
}
