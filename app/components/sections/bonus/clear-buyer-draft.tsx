"use client";

import { useEffect } from "react";
import { clearBuyer } from "@/lib/bonuses/buyer-storage";

/** Drops the buyer's saved details once the purchase is done; renders nothing. */
export function ClearBuyerDraft() {
  useEffect(() => {
    clearBuyer();
  }, []);
  return null;
}
