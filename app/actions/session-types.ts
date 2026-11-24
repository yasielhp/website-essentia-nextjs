"use server";

import { updateTag } from "next/cache";
import { saveSessionTypeCore } from "@/lib/session-types/save";
import { TIER_PRICES_CACHE_TAG } from "@/lib/treatments/prices";
import type { SessionTypeInput, SessionTypeSaveResult } from "@/types/settings";

/**
 * Shows a changed session type on the public site at once.
 *
 * The treatment cards and the agent tools read the prices of the session types
 * through a cache kept for five minutes (`listPublicTierPrices`), and the pages
 * that print them are prerendered. Without this, a price changed in Settings,
 * or a session type switched off there, went on showing as it was for up to
 * five minutes.
 *
 * `updateTag`, not `revalidateTag`: in a Server Action it expires the tag
 * immediately, so the very next visit waits for the new price instead of being
 * served the old one once more while it is read again. Dropping the tag also
 * drops the prerendered pages that used it.
 *
 * Not exported, so it is not an endpoint of its own: it used to be one, called
 * by the browser after the browser's own write, and anybody could have made
 * every visit read the prices again in a loop. It never throws: if it cannot
 * be done the save stands and the price shows when the five minutes are up.
 */
function refreshTierPrices(): void {
  try {
    updateTag(TIER_PRICES_CACHE_TAG);
  } catch {
    // The save stands; the site catches up when the five minutes pass.
  }
}

/**
 * Saves a session type from Settings and tells the site, in ONE call.
 *
 * Administrators only, and the rules are in `saveSessionTypeCore`: who may
 * write, which fields, and an answer within its deadline whatever the database
 * does. The table is written nowhere else, and never from the browser.
 *
 * The site is told whenever the write landed or may have (an answer of
 * `timeout` after the write was begun), also when the staff that came with it
 * could not be saved: the price is the part the public sees.
 *
 * Never throws and never returns the database's text; the error is a key the
 * screen translates.
 */
export async function saveSessionType(
  accessToken: string | null,
  tierId: string,
  input: SessionTypeInput,
): Promise<SessionTypeSaveResult> {
  const { reply, written } = await saveSessionTypeCore(
    accessToken,
    tierId,
    input,
  );
  if (written) refreshTierPrices();
  return reply;
}
