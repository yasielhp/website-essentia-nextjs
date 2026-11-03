import { getAdminClient } from "@/lib/insforge-admin";
import type { PublicBonusPlan } from "@/types/bonus";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One bonus plan as the public site may show it, found by id.
 *
 * SERVER ONLY. Same rule as the list on the treatment page: only a plan that is
 * active, on a session type that is active, and only the fields a visitor sees.
 * Anything else — an unknown id, a plan switched off, a malformed id — is null,
 * so the caller can answer with a 404 and give nothing away.
 */
export async function getPublicBonusPlan(
  planId: string,
): Promise<PublicBonusPlan | null> {
  if (!UUID.test(planId)) return null;

  const db = getAdminClient().database;
  const { data: planData } = await db
    .from("bonus_plans")
    .select("id, tier_id, sessions, price_eur, validity_days, active")
    .eq("id", planId)
    .maybeSingle();
  const plan = planData as {
    id: string;
    tier_id: string;
    sessions: number;
    price_eur: number | string;
    validity_days: number;
    active: boolean;
  } | null;
  if (!plan || !plan.active) return null;

  const { data: tierData } = await db
    .from("service_tiers")
    .select("label, active")
    .eq("id", plan.tier_id)
    .maybeSingle();
  const tier = tierData as { label: string | null; active: boolean } | null;
  if (!tier || !tier.active || !tier.label) return null;

  return {
    id: plan.id,
    sessions: plan.sessions,
    priceEur: Number(plan.price_eur),
    validityDays: plan.validity_days,
    tierLabel: tier.label,
  };
}
