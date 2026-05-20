"use client";

import { useEffect, useState } from "react";
import { insforge } from "@/lib/insforge";
import { PlansTabContent } from "@/components/dashboard/settings/plans-tab-content";
import { PlanModal } from "@/components/dashboard/settings/plan-modal";
import type { PlanRow } from "@/types/settings";

export default function MembersSettingsPage() {
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
    <div className="px-6 py-8 lg:px-10">
      {loading ? (
        <div className="border-sand-200 rounded-2xl border bg-white">
          <div className="border-sand-100 border-b px-6 py-4">
            <div className="bg-sand-100 h-4 w-32 animate-pulse rounded" />
          </div>
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="border-sand-200 rounded-xl border bg-white p-4"
              >
                <div className="bg-sand-100 h-4 w-24 animate-pulse rounded" />
                <div className="bg-sand-100 mt-2 h-3 w-16 animate-pulse rounded" />
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
