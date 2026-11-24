import { bookableServices } from "@/data/services-data";
import { getAdminClient } from "@/lib/insforge-admin";
import { toTierPrices, type TierPrice } from "@/lib/treatments/prices";

/**
 * What the session types of one service cost, as the public site may show it.
 *
 * SERVER ONLY. Only the session types that are on sale (`active`), and of each
 * only its name, its length and its price: what the booking form already shows
 * to anyone.
 * The service must be one the site has, so the argument cannot be used to ask
 * for anything else. A read that fails is no prices: a card without its price
 * is still a card, and one with a wrong price is worse than none.
 */
export async function listPublicTierPrices(
  serviceId: unknown,
): Promise<TierPrice[]> {
  if (
    typeof serviceId !== "string" ||
    !bookableServices.some((service) => service.id === serviceId)
  ) {
    return [];
  }

  try {
    const { data, error } = await getAdminClient()
      .database.from("service_tiers")
      .select("label, duration_minutes, price_eur, price_center_eur")
      .eq("service_id", serviceId)
      .eq("active", true)
      .order("sort_order");
    if (error) return [];
    return toTierPrices(data);
  } catch {
    return [];
  }
}
