"use server";

import type { TierPrice } from "@/lib/treatments/prices";
import { listPublicTierPrices } from "@/lib/treatments/public-prices";

/**
 * What the treatments of one service cost, for the one caller that is in the
 * browser: the WebMCP tool that lists the services to an agent
 * (`webmcp-tools.tsx`). The pages do not come through here: they read the same
 * prices on the server and print them in their HTML.
 *
 * Public on purpose (it is what the site shows to anyone) and read-only; what
 * may be asked for and what is answered are in `listPublicTierPrices`.
 */
// react-doctor-disable-next-line react-doctor/server-auth-actions
export async function fetchTreatmentPrices(
  serviceId: string,
): Promise<TierPrice[]> {
  return listPublicTierPrices(serviceId);
}
