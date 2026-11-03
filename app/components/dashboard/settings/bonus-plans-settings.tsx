"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { TierThumbnail } from "@/components/ui/tier-thumbnail";
import { insforge } from "@/lib/insforge";
import { getAccessToken } from "@/lib/client-session";
import { fetchBonusPlans } from "@/actions/bonuses";
import type { BonusPlan } from "@/types/bonus";
import { BonusPlanModal, type BonusTierOption } from "./bonus-plan-modal";

/** The bonus templates the desk sells from a contact's file. */
export function BonusPlansSettings() {
  const t = useTranslations("dashboard.settings.bonuses");
  const tTiers = useTranslations("dashboard.settings.tiers");
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
        <h2 className="font-display text-petroleum-700 text-xl">
          {t("heading")}
        </h2>
        <Button
          variant="solid"
          size="md"
          onClick={() => setEditing(null)}
          disabled={loading}
        >
          {t("new")}
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="border-sand-200 flex items-center gap-4 rounded-2xl border bg-white p-3"
            >
              <div className="bg-sand-100 size-16 shrink-0 animate-pulse rounded-xl" />
              <div className="flex flex-1 flex-col gap-2">
                <div className="bg-sand-100 h-4 w-40 animate-pulse rounded" />
                <div className="bg-sand-100 h-3 w-28 animate-pulse rounded" />
              </div>
              <div className="bg-sand-100 h-10 w-24 animate-pulse rounded-full" />
            </div>
          ))}
        </div>
      ) : plans.length === 0 ? (
        <p className="text-petroleum-300 text-sm">{t("empty")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {/* The session type's colour tints the row, as on the sessions list,
              so a bonus is recognised by what it is for. */}
          {plans.map((plan) => (
            <div
              key={plan.id}
              style={{
                backgroundColor: `color-mix(in srgb, ${plan.tierColor ?? "#6b7280"} 6%, white)`,
                borderColor: `color-mix(in srgb, ${plan.tierColor ?? "#6b7280"} 40%, white)`,
              }}
              className="flex items-center gap-4 rounded-2xl border p-3"
            >
              <div className="relative shrink-0">
                <TierThumbnail
                  imageUrl={plan.tierImageUrl}
                  color={plan.tierColor}
                  label={plan.tierLabel}
                  className="size-16"
                  sizes="64px"
                />
                <span
                  className={`absolute top-1 left-1 rounded-full px-2 py-0.5 text-[11px] leading-none font-medium shadow-sm ${
                    plan.active
                      ? "bg-green-100 text-green-700"
                      : "text-petroleum-400 bg-white/90"
                  }`}
                >
                  {plan.active ? tTiers("active") : tTiers("off")}
                </span>
              </div>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-petroleum-700 text-sm font-medium">
                  {t("sessions")} {plan.sessions}
                </span>
                <span className="text-petroleum-400 truncate text-xs">
                  {plan.tierLabel ?? "—"}
                </span>
              </span>
              <Button
                variant="solid"
                size="md"
                onClick={() => setEditing(plan)}
              >
                {t("edit")}
              </Button>
            </div>
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
