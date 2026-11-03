"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { fetchPublicBonusPlans } from "@/actions/bonuses-public";
import { formatPrice, type SupportedLocale } from "@/utils/format";
import type { PublicBonusPlan } from "@/types/bonus";
import { BonusPurchaseDialog } from "./bonus-purchase-dialog";

/**
 * The choice between one session and a bonus, and the bonuses on sale, on the
 * page of a treatment.
 *
 * It renders nothing at all unless the treatment's session type is active and
 * has at least one active bonus: a page without bonuses must look exactly as it
 * did before. The plans are read when the page opens rather than baked into
 * the static page, so switching a plan on or off in the dashboard shows
 * immediately.
 */
export function BonusOffer({
  tierLabel,
  bookingHref,
}: {
  /** The treatment's title, which is its session type's label. */
  tierLabel: string;
  bookingHref: string;
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
      <div className="mx-auto flex max-w-4xl flex-col gap-10 px-5 py-16 md:py-20">
        <div className="flex flex-col gap-6">
          <h2 className="font-display text-petroleum-700 text-3xl md:text-4xl">
            {t("heading")}
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-2xl bg-white p-6">
              <h3 className="text-petroleum-700 font-medium">
                {t("single.title")}
              </h3>
              <p className="text-petroleum-500 text-sm leading-relaxed">
                {t("single.body")}
              </p>
              <Button
                variant="outline"
                size="md"
                href={bookingHref}
                className="mt-auto w-full md:w-auto"
              >
                {t("single.cta")}
              </Button>
            </div>
            <div className="flex flex-col gap-3 rounded-2xl bg-white p-6">
              <h3 className="text-petroleum-700 font-medium">
                {t("bonus.title")}
              </h3>
              <p className="text-petroleum-500 text-sm leading-relaxed">
                {t("bonus.body")}
              </p>
              <Button
                variant="solid"
                size="md"
                href="#bonus-list"
                className="mt-auto w-full md:w-auto"
              >
                {t("bonus.cta")}
              </Button>
            </div>
          </div>
        </div>

        <div id="bonus-list" className="flex flex-col gap-4">
          <h3 className="font-display text-petroleum-700 text-2xl">
            {t("listHeading")}
          </h3>
          <ul className="flex flex-col gap-3">
            {plans.map((plan) => (
              <li
                key={plan.id}
                className="flex flex-col gap-4 rounded-2xl bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-0.5">
                  <p className="text-petroleum-700 font-medium">
                    {t("sessions", { sessions: plan.sessions })}
                  </p>
                  <p className="text-petroleum-700 text-sm">
                    {t("total", { price: formatPrice(plan.priceEur, locale) })}
                    {" · "}
                    {t("perSession", {
                      price: formatPrice(plan.priceEur / plan.sessions, locale),
                    })}
                  </p>
                  <p className="text-petroleum-400 text-xs">
                    {t("validity", { days: plan.validityDays })}
                  </p>
                </div>
                <Button
                  variant="solid"
                  size="md"
                  onClick={() => setBuying(plan)}
                  className="w-full sm:w-auto"
                >
                  {t("buy")}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {buying && (
        <BonusPurchaseDialog plan={buying} onClose={() => setBuying(null)} />
      )}
    </section>
  );
}
