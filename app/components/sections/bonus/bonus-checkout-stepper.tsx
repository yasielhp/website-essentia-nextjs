"use client";

import dynamic from "next/dynamic";
import type { BonusFamily } from "@/lib/bonuses/routes";
import type { PublicBonusPlan } from "@/types/bonus";

/**
 * The purchase steps keep the buyer's details in browser storage as they go, so
 * they stay client-only — the same arrangement as the booking form. The page's
 * heading and its way back are rendered on the server around it.
 */
const BonusCheckout = dynamic(
  () => import("./bonus-checkout").then((m) => ({ default: m.BonusCheckout })),
  { ssr: false },
);

export function BonusCheckoutStepper(props: {
  plans: PublicBonusPlan[];
  initialPlanId: string;
  family: BonusFamily;
  slug: string;
}) {
  return <BonusCheckout {...props} />;
}
