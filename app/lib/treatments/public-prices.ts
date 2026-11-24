import { unstable_cache } from "next/cache";
import { insforgePublic } from "@/lib/insforge-public";
import {
  TIER_PRICES_CACHE_TAG,
  type TierPrice,
  type TierSnapshot,
} from "@/lib/treatments/prices";
import {
  isBookableService,
  readTierSnapshot,
} from "@/lib/treatments/read-prices";
import {
  hiddenTreatmentIds,
  TREATMENTS_OF,
  type HiddenTreatments,
  type TreatmentFamily,
} from "@/lib/treatments/visibility";

/**
 * What the session types of one service cost, as the public site may show it,
 * and which of its treatments the site hides because their session type is
 * switched off.
 *
 * SERVER ONLY. It is what the treatment pages print on their cards (in the
 * HTML they are served with, so there is no price appearing after the page
 * does and a search engine reads it) and what the agent tools answer with.
 * Both answers come from ONE cached read of the service's session types, so a
 * page cannot show a card whose treatment the sitemap left out.
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
// the read the booking form already makes from the browser. The second key
// part is the shape of the answer: an entry kept by the code before it (a bare
// list of prices) is never handed to this one.
const cachedTierSnapshot = unstable_cache(
  (serviceId: string) => readTierSnapshot(insforgePublic.database, serviceId),
  ["tier-prices", "snapshot"],
  { revalidate: TIER_PRICES_REVALIDATE_SECONDS, tags: [TIER_PRICES_CACHE_TAG] },
);

/** The kept snapshot, or null when the read failed. Never throws. */
async function publicTierSnapshot(
  serviceId: string,
): Promise<TierSnapshot | null> {
  if (!isBookableService(serviceId)) return null;
  try {
    return await cachedTierSnapshot(serviceId);
  } catch {
    return null;
  }
}

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
  return (await publicTierSnapshot(serviceId))?.prices ?? [];
}

/**
 * The ids of the treatments of one service the site hides: their session type
 * is switched off and none of theirs is on sale (`hiddenTreatmentIds`).
 *
 * Never throws, and a read that fails hides NOTHING: every card is shown, as
 * the site always did, without a price (`listPublicTierPrices` answers no
 * prices on the same failure). A treatment taken off the site because the
 * database did not answer would be a worse mistake than one shown that is off.
 *
 * Kept under the same tag as the prices: switching a session type on or off in
 * Settings drops it (`refreshTierPrices`), and with it every prerendered page,
 * sitemap and file for assistants that hid or showed the treatment.
 */
export async function listHiddenTreatments(
  family: TreatmentFamily,
): Promise<string[]> {
  const snapshot = await publicTierSnapshot(family);
  return snapshot ? hiddenTreatmentIds(TREATMENTS_OF[family], snapshot) : [];
}

/** Whether one treatment is hidden (its page answers 404 while it is). */
export async function isTreatmentHidden(
  family: TreatmentFamily,
  treatmentId: string,
): Promise<boolean> {
  return (await listHiddenTreatments(family)).includes(treatmentId);
}

/** The hidden treatments of every family, for the sitemaps and `llms.txt`. */
export async function listAllHiddenTreatments(): Promise<HiddenTreatments> {
  const [manual, facial, iv] = await Promise.all([
    listHiddenTreatments("manual-therapies"),
    listHiddenTreatments("facial-therapies"),
    listHiddenTreatments("intravenous-therapy"),
  ]);
  return {
    "manual-therapies": manual,
    "facial-therapies": facial,
    "intravenous-therapy": iv,
  };
}
