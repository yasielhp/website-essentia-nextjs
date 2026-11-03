"use server";

import { getAdminClient } from "@/lib/insforge-admin";
import { sameTreatment } from "@/lib/treatments/match";
import type { PublicBonusPlan } from "@/types/bonus";

/**
 * The bonuses on sale for one session type, for the public treatment page.
 *
 * Public on purpose — it is what the page shows to anyone — and read-only. It
 * returns only active plans of active session types and only the fields a
 * visitor sees on the page: no ids of other tables, no clients, no orders.
 * The session type is found by its label, which is how a tier meets its
 * treatment page.
 */
// react-doctor-disable-next-line react-doctor/server-auth-actions
export async function fetchPublicBonusPlans(
  tierLabel: string,
): Promise<PublicBonusPlan[]> {
  const label = typeof tierLabel === "string" ? tierLabel.trim() : "";
  if (!label || label.length > 120) return [];

  const db = getAdminClient().database;
  const { data: tierData } = await db
    .from("service_tiers")
    .select("id, label")
    .eq("active", true);
  const tiers = ((tierData ?? []) as { id: string; label: string | null }[])
    .filter((t) => sameTreatment(t.label, label))
    .map((t) => ({ id: t.id, label: t.label as string }));
  if (tiers.length === 0) return [];

  const { data } = await db
    .from("bonus_plans")
    .select("id, tier_id, sessions, price_eur, validity_days")
    .in(
      "tier_id",
      tiers.map((t) => t.id),
    )
    .eq("active", true)
    .order("sessions", { ascending: true });

  const labelOf = new Map(tiers.map((t) => [t.id, t.label]));
  return (
    (data ?? []) as {
      id: string;
      tier_id: string;
      sessions: number;
      price_eur: number | string;
      validity_days: number;
    }[]
  ).map((p) => ({
    id: p.id,
    sessions: p.sessions,
    priceEur: Number(p.price_eur),
    validityDays: p.validity_days,
    tierLabel: labelOf.get(p.tier_id) ?? label,
  }));
}
