"use server";

import Stripe from "stripe";
import { insforge } from "@/lib/insforge";
import { bookableServices } from "@/data/services-data";

type TierData = {
  id: string;
  service_id: string;
  label: string | null;
  duration_minutes: number | null;
  price_eur: number | null;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
};

export async function syncSingleTierToStripe(tierId: string): Promise<{
  stripe_product_id: string;
  stripe_price_id: string;
}> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");

  const stripe = new Stripe(key);

  const { data, error } = await insforge.database
    .from("service_tiers")
    .select(
      "id, service_id, label, duration_minutes, price_eur, stripe_product_id, stripe_price_id",
    )
    .eq("id", tierId)
    .single();

  if (error || !data) throw new Error("Tier not found");

  const tier = data as TierData;
  const priceEur = Number(tier.price_eur ?? 0);
  if (!priceEur) throw new Error("Tier has no price set");

  const service = bookableServices.find((s) => s.id === tier.service_id);
  const serviceName = service?.title ?? tier.service_id;
  const durationSuffix = tier.duration_minutes
    ? ` (${tier.duration_minutes} min)`
    : "";
  const productName = `${serviceName} — ${tier.label ?? "Standard"}${durationSuffix}`;

  // Create product if it doesn't exist yet
  let productId = tier.stripe_product_id;
  if (!productId) {
    const product = await stripe.products.create({
      name: productName,
      metadata: { tier_id: tierId, service_id: tier.service_id },
    });
    productId = product.id;
  }

  // Archive the existing price (prices are immutable in Stripe)
  if (tier.stripe_price_id) {
    try {
      await stripe.prices.update(tier.stripe_price_id, { active: false });
    } catch {
      // Already archived or missing — ignore
    }
  }

  // Create a new price with the current amount
  const price = await stripe.prices.create({
    product: productId,
    unit_amount: Math.round(priceEur * 100),
    currency: "eur",
    metadata: { tier_id: tierId },
  });

  await insforge.database
    .from("service_tiers")
    .update({ stripe_product_id: productId, stripe_price_id: price.id })
    .eq("id", tierId);

  return { stripe_product_id: productId, stripe_price_id: price.id };
}
