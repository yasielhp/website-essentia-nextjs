import { bookableServices } from "@/data/services-data";
import type { getAdminClient } from "@/lib/insforge-admin";
import { toTierSnapshot, type TierSnapshot } from "@/lib/treatments/prices";

type Db = ReturnType<typeof getAdminClient>["database"];

/**
 * The session types of one service, as the public site needs them: the read
 * itself, with the database handed in so it is tested without one.
 *
 * Every session type of the service, on sale or switched off, and of each only
 * its name, its length, its price and whether it is on sale: what the booking
 * form already reads for anyone. The ones on sale are priced; the names of the
 * ones switched off are what hides their treatment from the site while they
 * are off (`hiddenTreatmentIds`). The service must be one the site has; any
 * other is nothing, and nothing is read.
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

const NOTHING: TierSnapshot = { prices: [], onSale: [], switchedOff: [] };

export async function readTierSnapshot(
  db: Db,
  serviceId: unknown,
): Promise<TierSnapshot> {
  if (!isBookableService(serviceId)) return NOTHING;

  let read: { data: unknown; error: unknown };
  try {
    read = await db
      .from("service_tiers")
      .select("label, duration_minutes, price_eur, price_center_eur, active")
      .eq("service_id", serviceId)
      .order("sort_order");
  } catch {
    throw new Error("tier prices: the read failed");
  }
  if (read.error) throw new Error("tier prices: the read failed");
  return toTierSnapshot(read.data);
}
