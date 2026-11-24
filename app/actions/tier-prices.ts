"use server";

import { updateTag } from "next/cache";
import { ADMIN_ROLES, requireRole } from "@/lib/auth-guard";
import { TIER_PRICES_CACHE_TAG } from "@/lib/treatments/prices";

/**
 * Shows a changed session type on the public site at once.
 *
 * The treatment cards and the agent tools read the prices of the session types
 * through a cache kept for five minutes (`listPublicTierPrices`), and the pages
 * that print them are prerendered. Without this, a price changed in Settings,
 * or a session type switched off there, went on showing as it was for up to
 * five minutes.
 *
 * A session type is written from the browser, under the administrator's own
 * session, so there is no server action of the write to do this in: Settings
 * calls this one right after it. `updateTag`, not `revalidateTag`: in a Server
 * Action it expires the tag immediately, so the very next visit waits for the
 * new price instead of being served the old one once more while it is read
 * again. Dropping the tag also drops the prerendered pages that used it.
 *
 * Administrators only, like the screen that calls it: a Server Action is a
 * public endpoint, and left open anyone could make every visit read the
 * prices from the database again, in a loop. It never throws: if it cannot be
 * done the save stands and the price shows when the five minutes are up.
 */
export async function refreshTierPrices(
  accessToken: string | null,
): Promise<{ ok: boolean }> {
  try {
    await requireRole(accessToken, ADMIN_ROLES);
  } catch {
    // Not an administrator, or the session could not be checked: either way
    // nothing is dropped.
    return { ok: false };
  }

  try {
    updateTag(TIER_PRICES_CACHE_TAG);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
