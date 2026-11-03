"use server";

import { listPublicBonusPlans } from "@/lib/bonuses/public";
import type { PublicBonusPlan } from "@/types/bonus";

/**
 * The bonuses on sale for one session type, for the public treatment page.
 *
 * Public on purpose — it is what the page shows to anyone — and read-only; the
 * filtering is in `listPublicBonusPlans`.
 */
// react-doctor-disable-next-line react-doctor/server-auth-actions
export async function fetchPublicBonusPlans(
  tierLabel: string,
): Promise<PublicBonusPlan[]> {
  return listPublicBonusPlans(tierLabel);
}
