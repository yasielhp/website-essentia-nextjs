"use server";

import Stripe from "stripe";
import { insforge } from "@/lib/insforge";
import { bookableServices } from "@/data/services-data";

type TierRow = {
  id: string;
  service_id: string;
  label: string | null;
  duration_minutes: number | null;
  price_eur: number | null;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
};

export async function syncServiceTiersToStripe(): Promise<{
  synced: number;
  errors: string[];
}> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");

  const stripe = new Stripe(key);

  const { data: tiers, error } = await insforge.database
    .from("service_tiers")
    .select(
      "id, service_id, label, duration_minutes, price_eur, stripe_product_id, stripe_price_id",
    )
    .eq("active", true);

  if (error || !tiers) throw new Error("Failed to fetch tiers");

  const errors: string[] = [];
  let synced = 0;

  for (const tier of tiers as TierRow[]) {
    try {
      const priceEur = Number(tier.price_eur ?? 0);
      if (!priceEur) continue;

      const service = bookableServices.find((s) => s.id === tier.service_id);
      const serviceName = service?.title ?? tier.service_id;
      const durationSuffix = tier.duration_minutes
        ? ` (${tier.duration_minutes} min)`
        : "";
      const productName = `${serviceName} — ${tier.label ?? "Standard"}${durationSuffix}`;

      let productId = tier.stripe_product_id;
      let priceId = tier.stripe_price_id;

      if (!productId) {
        const product = await stripe.products.create({
          name: productName,
          metadata: { tier_id: tier.id, service_id: tier.service_id },
        });
        productId = product.id;
      }

      if (!priceId) {
        const price = await stripe.prices.create({
          product: productId,
          unit_amount: Math.round(priceEur * 100),
          currency: "eur",
          metadata: { tier_id: tier.id },
        });
        priceId = price.id;
      }

      if (
        productId !== tier.stripe_product_id ||
        priceId !== tier.stripe_price_id
      ) {
        await insforge.database
          .from("service_tiers")
          .update({ stripe_product_id: productId, stripe_price_id: priceId })
          .eq("id", tier.id);
      }

      synced++;
    } catch (err) {
      errors.push(
        `Tier ${tier.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return { synced, errors };
}
