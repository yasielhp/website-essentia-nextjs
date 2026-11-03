import { type NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/insforge-admin";
import { getRedsysProvider } from "@/lib/payments";
import { getAppUrl } from "@/lib/env";
import { bonusCheckoutSchema } from "@/lib/schemas";
import { bonusOrderId, toCents } from "@/lib/bonuses/orders";

/**
 * Starts the payment for a bonus bought on the public site.
 *
 * Anonymous by nature, so it trusts nothing but the plan's id: the price,
 * sessions and validity are read from the database, and only for a plan that is
 * active on a session type that is active. They are copied onto the order, so
 * a price changed afterwards cannot alter what this client is charged.
 *
 * The response is the Redsys form and nothing else; the order is not echoed
 * back, and personal data is never logged.
 */
export async function POST(req: NextRequest) {
  const provider = getRedsysProvider();
  if (!provider) {
    return NextResponse.json(
      { error: "Redsys not configured" },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = bonusCheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const input = parsed.data;

  const db = getAdminClient().database;

  const { data: planData } = await db
    .from("bonus_plans")
    .select("id, tier_id, sessions, price_eur, validity_days, active")
    .eq("id", input.planId)
    .maybeSingle();
  const plan = planData as {
    id: string;
    tier_id: string;
    sessions: number;
    price_eur: number | string;
    validity_days: number;
    active: boolean;
  } | null;

  const { data: tierData } = plan
    ? await db
        .from("service_tiers")
        .select("label, active")
        .eq("id", plan.tier_id)
        .maybeSingle()
    : { data: null };
  const tier = tierData as { label: string | null; active: boolean } | null;

  if (!plan || !plan.active || !tier || !tier.active) {
    return NextResponse.json({ error: "Bonus not available" }, { status: 404 });
  }

  const priceEur = Number(plan.price_eur);
  if (!Number.isFinite(priceEur) || priceEur <= 0) {
    return NextResponse.json(
      { error: "Bonus has no price configured" },
      { status: 400 },
    );
  }

  const { data: created, error: insertError } = await db
    .from("bonus_orders")
    .insert([
      {
        plan_id: plan.id,
        tier_id: plan.tier_id,
        sessions: plan.sessions,
        price_eur: priceEur,
        validity_days: plan.validity_days,
        first_name: input.firstName,
        last_name: input.lastName,
        email: input.email.toLowerCase(),
        phone: input.phone,
        preferred_language: input.locale,
        status: "pending",
      },
    ])
    .select("id")
    .single();
  const orderRowId = (created as { id: string } | null)?.id;
  if (insertError || !orderRowId) {
    console.error("[bonus-session] could not create the order");
    return NextResponse.json({ error: "Order failed" }, { status: 500 });
  }

  const appUrl = getAppUrl();
  const prefix = input.locale === "es" ? "/es" : "";
  const sessionsText =
    input.locale === "es"
      ? `Bono ${plan.sessions} sesiones`
      : `${plan.sessions}-session voucher`;
  const formData = provider.buildFormData({
    amount: toCents(priceEur),
    orderId: bonusOrderId(),
    currency: "978", // EUR
    description: `${sessionsText} - ${tier.label ?? ""}`,
    successUrl: `${appUrl}${prefix}/bonus/confirmation`,
    cancelUrl: `${appUrl}${prefix}/bonus/cancelled`,
    customerEmail: input.email,
    customerName: `${input.firstName} ${input.lastName}`.trim(),
    metadata: { notifyUrl: `${appUrl}/api/webhooks/redsys` },
  });

  // The notification finds the order by this number.
  const { error: orderError } = await db
    .from("bonus_orders")
    .update({ redsys_order: formData.orderId })
    .eq("id", orderRowId);
  if (orderError) {
    await db
      .from("bonus_orders")
      .update({ status: "failed" })
      .eq("id", orderRowId);
    console.error("[bonus-session] could not store the Redsys order number");
    return NextResponse.json({ error: "Order failed" }, { status: 500 });
  }

  return NextResponse.json(formData);
}
