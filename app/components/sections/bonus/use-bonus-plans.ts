"use client";

import { useEffect, useState } from "react";
import { fetchPublicBonusPlans } from "@/actions/bonuses-public";
import type { PublicBonusPlan } from "@/types/bonus";

/**
 * The bonuses on sale for a treatment, read when the page opens rather than
 * baked into the static page, so switching a plan on or off in the dashboard
 * shows immediately. Empty until read, and empty for a treatment with none:
 * the hero's button and the offer at the bottom both hang from it, so a page
 * is either all about bonuses or not at all.
 */
export function useBonusPlans(
  tierLabel: string,
  enabled: boolean,
): PublicBonusPlan[] {
  const [plans, setPlans] = useState<PublicBonusPlan[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void fetchPublicBonusPlans(tierLabel)
      .then((rows) => {
        if (!cancelled) setPlans(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tierLabel, enabled]);

  return plans;
}
