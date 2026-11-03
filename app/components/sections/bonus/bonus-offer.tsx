"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { fetchPublicBonusPlans } from "@/actions/bonuses-public";
import { formatPrice, type SupportedLocale } from "@/utils/format";
import type { PublicBonusPlan } from "@/types/bonus";
import { BonusPurchaseDialog } from "./bonus-purchase-dialog";

/**
 * The bonuses on sale for a treatment, on the page of that treatment.
 *
 * It renders nothing at all unless the treatment's session type is active and
 * has at least one active bonus: a page without bonuses must look exactly as it
 * did before. The plans are read when the page opens rather than baked into
 * the static page, so switching a plan on or off in the dashboard shows
 * immediately.
 */
export function BonusOffer({
  tierLabel,
}: {
  /** The treatment's title, which is its session type's label. */
  tierLabel: string;
}) {
  const t = useTranslations("bonus.offer");
  const locale = useLocale() as SupportedLocale;
  const [plans, setPlans] = useState<PublicBonusPlan[]>([]);
  const [buying, setBuying] = useState<PublicBonusPlan | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchPublicBonusPlans(tierLabel)
      .then((rows) => {
        if (!cancelled) setPlans(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tierLabel]);

  if (plans.length === 0) return null;

  return (
    <section id="bonuses" className="bg-sand-100">
      <div className="mx-auto flex max-w-4xl flex-col gap-8 px-5 py-16 md:py-20">
        <div className="flex max-w-2xl flex-col gap-3">
          <h2 className="font-display text-petroleum-700 text-3xl md:text-4xl">
            {t("heading")}
          </h2>
          <p className="text-petroleum-500 leading-relaxed">{t("intro")}</p>
        </div>

        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {plans.map((plan) => (
            <li
              key={plan.id}
              className="flex flex-col gap-5 rounded-2xl bg-white p-6"
            >
              <div className="flex flex-col gap-1">
                <p className="font-display text-petroleum-700 text-3xl">
                  {t("sessions", { sessions: plan.sessions })}
                </p>
                <p className="text-petroleum-700 text-lg font-medium">
                  {t("perSession", {
                    price: formatPrice(plan.priceEur / plan.sessions, locale),
                  })}
                </p>
              </div>
              <div className="border-sand-100 flex flex-col gap-1 border-t pt-4">
                <p className="text-petroleum-500 text-sm">
                  {t("total", { price: formatPrice(plan.priceEur, locale) })}
                </p>
                <p className="text-petroleum-400 text-xs">
                  {t("validity", { days: plan.validityDays })}
                </p>
              </div>
              <Button
                variant="solid"
                size="md"
                onClick={() => setBuying(plan)}
                className="mt-auto w-full"
              >
                {t("buy")}
              </Button>
            </li>
          ))}
        </ul>
      </div>

      {buying && (
        <BonusPurchaseDialog plan={buying} onClose={() => setBuying(null)} />
      )}
    </section>
  );
}
