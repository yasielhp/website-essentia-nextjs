import { type NextRequest, NextResponse } from "next/server";
import { insforge } from "@/lib/insforge";
import { RedsysProvider } from "@/lib/payments/redsys";

function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function buildRedsysProvider(): RedsysProvider | null {
  const merchantCode = process.env.REDSYS_MERCHANT_CODE;
  const terminal = process.env.REDSYS_TERMINAL ?? "001";
  const secretKey = process.env.REDSYS_SECRET_KEY;
  if (!merchantCode || !secretKey) return null;
  return new RedsysProvider({
    merchantCode,
    terminal,
    secretKey,
    environment: (process.env.REDSYS_ENVIRONMENT as "test" | "live") ?? "test",
  });
}

export async function POST(req: NextRequest) {
  const provider = buildRedsysProvider();
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
    successUrl: `${appUrl}/community/memberships?payment=success&planId=${planId}`,
    cancelUrl: `${appUrl}/community/memberships?payment=cancel`,
    customerEmail: email || undefined,
    metadata: { notifyUrl: `${appUrl}/api/webhooks/redsys` },
  });

  return NextResponse.json(formData);
}
