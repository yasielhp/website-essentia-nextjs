"use server";

import type { TierPrice } from "@/lib/treatments/prices";
import { listPublicTierPrices } from "@/lib/treatments/public-prices";

/**
 * What the treatments of one service cost, for the cards of its public page.
 *
 * Public on purpose (it is what the page shows to anyone) and read-only; what
 * may be asked for and what is answered are in `listPublicTierPrices`.
 */
// react-doctor-disable-next-line react-doctor/server-auth-actions
export async function fetchTreatmentPrices(
  serviceId: string,
): Promise<TierPrice[]> {
  return listPublicTierPrices(serviceId);
}
