"use client";

import { useEffect, useState } from "react";
import { insforge } from "@/lib/insforge";
import { PlansTabContent } from "@/components/dashboard/settings/plans-tab-content";
import { PlanModal } from "@/components/dashboard/settings/plan-modal";
import type { PlanRow } from "@/types/settings";

export function SubscriptionsSettings() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [planModal, setPlanModal] = useState<PlanRow | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadPlans() {
    const { data } = await insforge.database
      .from("membership_plans")
      .select("id, label, price_monthly")
      .order("price_monthly");
    setPlans((data as PlanRow[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    async function load() {
      await loadPlans();
    }
    void load();
  }, []);

  return (
    <div>
      {loading ? (
        <div className="flex flex-col gap-4">
          <div className="flex h-10 items-center">
            <div className="bg-sand-100 h-7 w-48 animate-pulse rounded" />
          </div>
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="border-sand-200 flex items-center gap-4 rounded-2xl border bg-white p-3"
              >
                <div className="bg-sand-100 size-16 shrink-0 animate-pulse rounded-xl" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <div className="bg-sand-100 h-4 w-32 animate-pulse rounded" />
                  <div className="bg-sand-100 h-3 w-20 animate-pulse rounded" />
                </div>
                <div className="bg-sand-100 h-10 w-24 animate-pulse rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <PlansTabContent plans={plans} onEdit={(plan) => setPlanModal(plan)} />
      )}

      {planModal && (
        <PlanModal
          plan={planModal}
          onClose={() => setPlanModal(null)}
          onSaved={loadPlans}
        />
      )}
    </div>
  );
}
