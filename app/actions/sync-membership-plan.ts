"use server";

import Stripe from "stripe";
import { insforge } from "@/lib/insforge";

type PlanData = {
  id: string;
  label: string;
  price_monthly: number | null;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
};

export type StripePriceEntry = {
  id: string;
  unit_amount: number | null;
  active: boolean;
  created: number;
  currency: string;
};

export async function syncPlanToStripe(planId: string): Promise<{
  stripe_product_id: string;
  stripe_price_id: string;
}> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");

  const stripe = new Stripe(key);

  const { data, error } = await insforge.database
    .from("membership_plans")
    .select("id, label, price_monthly, stripe_product_id, stripe_price_id")
    .eq("id", planId)
    .single();

  if (error || !data) throw new Error("Plan not found");

  const plan = data as PlanData;
  const priceMonthly = Number(plan.price_monthly ?? 0);
  if (!priceMonthly) throw new Error("Plan has no monthly price set");

  // Create product if missing
  let productId = plan.stripe_product_id;
  if (!productId) {
    const product = await stripe.products.create({
      name: `Essentia — ${plan.label}`,
      metadata: { plan_id: planId },
    });
    productId = product.id;
  }

  // Archive current price (prices are immutable)
  if (plan.stripe_price_id) {
    try {
      await stripe.prices.update(plan.stripe_price_id, { active: false });
    } catch {
      // Already archived or missing
    }
  }

  // Create new recurring monthly price
  const price = await stripe.prices.create({
    product: productId,
    unit_amount: Math.round(priceMonthly * 100),
    currency: "eur",
    recurring: { interval: "month" },
    metadata: { plan_id: planId },
  });

  await insforge.database
    .from("membership_plans")
    .update({
      stripe_product_id: productId,
      stripe_price_id: price.id,
      stripe_synced_price: priceMonthly,
    })
    .eq("id", planId);

  return { stripe_product_id: productId, stripe_price_id: price.id };
}

export async function getPlanPriceHistory(
  productId: string,
): Promise<StripePriceEntry[]> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");

  const stripe = new Stripe(key);

  const prices = await stripe.prices.list({
    product: productId,
    limit: 50,
  });

  return prices.data.map((p) => ({
    id: p.id,
    unit_amount: p.unit_amount,
    active: p.active,
    created: p.created,
    currency: p.currency,
  }));
}

export async function getPlanMemberCount(planLabel: string): Promise<number> {
  const { count } = await insforge.database
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("plan", planLabel)
    .eq("status", "active");

  return count ?? 0;
}

export async function syncAllPlansToStripe(): Promise<{
  synced: Array<{
    id: string;
    stripe_product_id: string;
    stripe_price_id: string;
  }>;
  errors: Array<{ id: string; label: string; error: string }>;
}> {
  const { data, error } = await insforge.database
    .from("membership_plans")
    .select(
      "id, label, price_monthly, stripe_product_id, stripe_price_id, stripe_synced_price",
    );

  if (error || !data) throw new Error("Failed to fetch membership plans");

  const allPlans = data as (PlanData & {
    stripe_synced_price: number | null;
  })[];

  // Only sync plans that are not yet synced or whose price has changed
  const plansToSync = allPlans.filter((p) => {
    if (!p.stripe_price_id) return true;
    if (p.stripe_synced_price == null) return true;
    return (
      Math.abs(Number(p.price_monthly) - Number(p.stripe_synced_price)) > 0.001
    );
  });

  const results: {
    synced: Array<{
      id: string;
      stripe_product_id: string;
      stripe_price_id: string;
    }>;
    errors: Array<{ id: string; label: string; error: string }>;
  } = { synced: [], errors: [] };

  for (const plan of plansToSync) {
    try {
      const result = await syncPlanToStripe(plan.id);
      results.synced.push({ id: plan.id, ...result });
    } catch (err) {
      results.errors.push({
        id: plan.id,
        label: plan.label,
        error: err instanceof Error ? err.message : "Sync failed",
      });
    }
  }

  return results;
}
