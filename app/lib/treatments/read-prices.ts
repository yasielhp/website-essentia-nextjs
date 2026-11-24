import { bookableServices } from "@/data/services-data";
import type { getAdminClient } from "@/lib/insforge-admin";
import { toTierPrices, type TierPrice } from "@/lib/treatments/prices";

type Db = ReturnType<typeof getAdminClient>["database"];

/**
 * What the session types of one service cost: the read itself, with the
 * database handed in so it is tested without one.
 *
 * Only the session types that are on sale (`active`), and of each only its
 * name, its length and its price: what the booking form already shows to
 * anyone. The service must be one the site has; any other is no prices and
 * nothing is read.
 *
 * A database that cannot be read THROWS rather than answering "no prices".
 * The caller keeps the answer for a few minutes, and "there are none" must not
 * be kept when the truth is "could not ask". The error carries no text of the
 * database's.
 */
/** Whether this is one of the services the site has. Anything else is asked nothing. */
export function isBookableService(serviceId: unknown): serviceId is string {
  return (
    typeof serviceId === "string" &&
    bookableServices.some((service) => service.id === serviceId)
  );
}

export async function readTierPrices(
  db: Db,
  serviceId: unknown,
): Promise<TierPrice[]> {
  if (!isBookableService(serviceId)) return [];

  let read: { data: unknown; error: unknown };
  try {
    read = await db
      .from("service_tiers")
      .select("label, duration_minutes, price_eur, price_center_eur")
      .eq("service_id", serviceId)
      .eq("active", true)
      .order("sort_order");
  } catch {
    throw new Error("tier prices: the read failed");
  }
  if (read.error) throw new Error("tier prices: the read failed");
  return toTierPrices(read.data);
}
