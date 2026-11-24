"use client";

import { useEffect, useState } from "react";
import { fetchTreatmentPrices } from "@/actions/treatment-prices";
import type { TierPrice } from "@/lib/treatments/prices";

/**
 * What the treatments of a service cost, read when the page opens rather than
 * baked into the static page or typed into a translation: the centre changes
 * its prices from the dashboard, and the card must say what the booking form
 * will. Empty until read, and empty if the read fails, in which case a card
 * simply shows no price.
 */
export function useTreatmentPrices(serviceId: string): TierPrice[] {
  const [prices, setPrices] = useState<TierPrice[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetchTreatmentPrices(serviceId)
      .then((rows) => {
        if (!cancelled) setPrices(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [serviceId]);

  return prices;
}
