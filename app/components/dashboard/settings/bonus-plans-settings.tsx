"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { insforge } from "@/lib/insforge";
import { getAccessToken } from "@/lib/client-session";
import { fetchBonusPlans } from "@/actions/bonuses";
import { formatPrice, type SupportedLocale } from "@/utils/format";
import type { BonusPlan } from "@/types/bonus";
import { BonusPlanModal, type BonusTierOption } from "./bonus-plan-modal";

/** The bonus templates the desk sells from a contact's file. */
export function BonusPlansSettings() {
  const t = useTranslations("dashboard.settings.bonuses");
  const locale = useLocale() as SupportedLocale;
  const [plans, setPlans] = useState<BonusPlan[]>([]);
  const [tiers, setTiers] = useState<BonusTierOption[]>([]);
  const [loading, setLoading] = useState(true);
  // `undefined` closed, `null` a new plan, a plan an edit.
  const [editing, setEditing] = useState<BonusPlan | null | undefined>(
    undefined,
  );

  const load = useCallback(async () => {
    const [list, tierRes] = await Promise.all([
      fetchBonusPlans(getAccessToken()),
      insforge.database
        .from("service_tiers")
        .select("id, label")
        .eq("active", true)
        .order("label"),
    ]);
    setPlans(list);
    setTiers(
      ((tierRes.data ?? []) as { id: string; label: string | null }[]).map(
        (r) => ({ id: r.id, label: r.label ?? r.id }),
      ),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    async function run() {
      await load();
    }
    void run();
  }, [load]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-petroleum-700 text-sm font-semibold">
          {t("heading")}
        </h2>
        <Button
          variant="solid"
          size="sm"
          onClick={() => setEditing(null)}
          disabled={loading}
        >
          {t("new")}
        </Button>
      </div>

      {loading ? (
        <div className="bg-sand-100 h-16 animate-pulse rounded-xl" />
      ) : plans.length === 0 ? (
        <p className="text-petroleum-300 text-sm">{t("empty")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => setEditing(plan)}
              className="border-sand-200 hover:bg-sand-50 flex flex-col gap-1 rounded-xl border bg-white p-4 text-left transition-colors"
            >
              <span className="text-petroleum-700 text-sm font-semibold">
                {plan.name}
              </span>
              <span className="text-petroleum-400 text-xs">
                {plan.tierLabel ?? "—"} ·{" "}
                {t("sessionsCount", { n: plan.sessions })} ·{" "}
                {formatPrice(plan.priceEur, locale)}
              </span>
              <span className="text-petroleum-400 text-xs">
                {t("validityDays", { n: plan.validityDays })}
                {!plan.active && ` · ${t("inactive")}`}
                {plan.sellOnline && ` · ${t("online")}`}
              </span>
            </button>
          ))}
        </div>
      )}

      {editing !== undefined && (
        <BonusPlanModal
          plan={editing}
          tiers={tiers}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            void load();
          }}
        />
      )}
    </div>
  );
}
