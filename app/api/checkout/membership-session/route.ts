import { type NextRequest, NextResponse } from "next/server";
import { insforgePublic as insforge } from "@/lib/insforge-public";
import { getRedsysProvider } from "@/lib/payments";
import { getAppUrl } from "@/lib/env";
import { MEMBERSHIPS_ON_SALE } from "@/constants/memberships";

export async function POST(req: NextRequest) {
  // Memberships are not on sale: no plan is read and nothing goes to the bank,
  // whoever calls. One switch, `MEMBERSHIPS_ON_SALE`, turns this back on.
  if (!MEMBERSHIPS_ON_SALE) {
    return NextResponse.json(
      { error: "memberships_not_on_sale" },
      { status: 404 },
    );
  }

  const provider = getRedsysProvider();
  if (!provider) {
    return NextResponse.json(
      { error: "Redsys not configured" },
      { status: 500 },
    );
  }

  let body: { planId: string; email?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { planId, email } = body;
  if (!planId) {
    return NextResponse.json({ error: "planId is required" }, { status: 400 });
  }

  const { data: plan } = await insforge.database
    .from("membership_plans")
    .select("label, price_monthly")
    .eq("id", planId)
    .single();

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const planData = plan as { label: string; price_monthly: number | null };
  const priceMonthly = Number(planData.price_monthly ?? 0);

  if (priceMonthly <= 0) {
    return NextResponse.json(
      { error: "Plan has no price configured" },
      { status: 400 },
    );
  }

  const appUrl = getAppUrl();
  const formData = provider.buildFormData({
    amount: Math.round(priceMonthly * 100),
    currency: "978",
    description: `Essentia — ${planData.label}`,
    successUrl: `${appUrl}/experiences/memberships?payment=success&planId=${planId}`,
    cancelUrl: `${appUrl}/experiences/memberships?payment=cancel`,
    customerEmail: email || undefined,
    metadata: { notifyUrl: `${appUrl}/api/webhooks/redsys` },
  });

  return NextResponse.json(formData);
}
