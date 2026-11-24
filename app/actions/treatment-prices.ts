"use server";

import type { TierPrice } from "@/lib/treatments/prices";
import {
  listHiddenTreatments,
  listPublicTierPrices,
} from "@/lib/treatments/public-prices";
import { isTreatmentFamily } from "@/lib/treatments/visibility";

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

/**
 * The treatments of one service the site hides because their session type is
 * switched off, for the same caller: it leaves them out of the list it gives
 * an agent, as the site has no page for them. Public on purpose (the site
 * shows the same by leaving their cards out); anything that is not one of the
 * services is nothing, and nothing is read. A read that fails hides nothing.
 */
// react-doctor-disable-next-line react-doctor/server-auth-actions
export async function fetchHiddenTreatments(
  serviceId: string,
): Promise<string[]> {
  return isTreatmentFamily(serviceId) ? listHiddenTreatments(serviceId) : [];
}
