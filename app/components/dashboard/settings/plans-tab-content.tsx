"use client";

import type { PlanRow } from "@/types/settings";

const intl = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "EUR",
});

// ─── Plan Card (column) ───────────────────────────────────────

function PlanCard({ plan, onEdit }: { plan: PlanRow; onEdit: () => void }) {
  return (
    <div className="border-sand-200 flex flex-col rounded-xl border bg-white p-4">
      <button
        type="button"
        onClick={onEdit}
        className="hover:bg-sand-50 flex flex-col gap-0.5 rounded-lg p-1 text-left transition-colors"
      >
        <span className="text-petroleum-700 text-sm font-semibold capitalize">
          {plan.label}
        </span>
        <span className="text-petroleum-400 text-xs">
          {plan.price_monthly != null
            ? `${intl.format(plan.price_monthly)} / mo`
            : "No price set"}
        </span>
      </button>
    </div>
  );
}

// ─── Plans Tab Content ────────────────────────────────────────

export function PlansTabContent({
  plans,
  onEdit,
}: {
  plans: PlanRow[];
  onEdit: (plan: PlanRow) => void;
}) {
  return (
    <div className="border-sand-200 rounded-2xl border bg-white">
      <div className="border-sand-100 border-b px-6 py-4">
        <h2 className="text-petroleum-700 text-sm font-semibold">
          Membership Plans
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
        {plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} onEdit={() => onEdit(plan)} />
        ))}
      </div>
    </div>
  );
}
