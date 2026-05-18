"use client";

import { useState } from "react";
import type { PlanRow } from "@/types/settings";
import {
  syncPlanToStripe,
  getPlanPriceHistory,
  getPlanMemberCount,
  type StripePriceEntry,
} from "@/actions/sync-membership-plan";

const intl = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "EUR",
});

function formatDate(unix: number) {
  return new Date(unix * 1000).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type PlanCardProps = {
  plan: PlanRow;
  onEdit: () => void;
  onSynced: (updated: Pick<PlanRow, "id" | "stripe_product_id" | "stripe_price_id">) => void;
};

function PlanCard({ plan, onEdit, onSynced }: PlanCardProps) {
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const isSynced = !!plan.stripe_price_id;

  async function handleSync(e: React.MouseEvent) {
    e.stopPropagation();
    setSyncing(true);
    setSyncError(null);
    try {
      const result = await syncPlanToStripe(plan.id);
      onSynced({ id: plan.id, ...result });
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="border-sand-200 rounded-xl border bg-white">
      <div className="flex items-center gap-3 p-4">
        {/* Plan info — clickable */}
        <button
          type="button"
          onClick={onEdit}
          className="hover:bg-sand-50 flex flex-1 flex-col gap-0.5 rounded-lg p-1 text-left transition-colors"
        >
          <span className="text-petroleum-700 text-sm font-semibold">
            {plan.label}
          </span>
          <span className="text-petroleum-400 text-xs">
            {plan.price_monthly != null
              ? `€${plan.price_monthly} / mo`
              : "No price set"}
          </span>
        </button>

        {/* Sync button */}
        <button
          type="button"
          disabled={syncing}
          onClick={(e) => void handleSync(e)}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
            isSynced
              ? "border-sand-200 text-petroleum-500 hover:bg-sand-50 border"
              : "bg-[#635BFF] text-white hover:bg-[#5a52e8]"
          }`}
          title={isSynced ? "Re-sync (archives old price, creates new)" : "Create Stripe subscription"}
        >
          {syncing ? (
            <>
              <span className="size-3 animate-spin rounded-full border-2 border-current/30 border-t-current" />
              Syncing…
            </>
          ) : isSynced ? (
            "Re-sync"
          ) : (
            "Sync to Stripe"
          )}
        </button>
      </div>

      {syncError && (
        <p className="border-sand-100 border-t px-4 pb-3 text-xs text-red-500">
          {syncError}
        </p>
      )}
    </div>
  );
}

type HistoryRow = StripePriceEntry & { memberCount?: number };

type PriceHistoryTableProps = {
  productId: string;
  planLabel: string;
};

function PriceHistoryTable({ productId, planLabel }: PriceHistoryTableProps) {
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const [prices, memberCount] = await Promise.all([
      getPlanPriceHistory(productId),
      getPlanMemberCount(planLabel),
    ]);
    // All active members go to current plan label — attach count only to active price
    setRows(
      prices.map((p) => ({
        ...p,
        memberCount: p.active ? memberCount : undefined,
      })),
    );
    setLoading(false);
  }

  if (!rows && !loading) {
    return (
      <button
        type="button"
        onClick={() => void load()}
        className="text-petroleum-400 hover:text-petroleum-600 mt-1 px-4 pb-4 text-xs underline-offset-2 hover:underline"
      >
        View price history
      </button>
    );
  }

  if (loading) {
    return (
      <div className="space-y-2 px-4 pb-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-sand-100 h-8 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (!rows?.length) {
    return (
      <p className="text-petroleum-400 px-4 pb-4 text-xs">No prices found.</p>
    );
  }

  return (
    <div className="overflow-x-auto px-4 pb-4">
      <table className="w-full min-w-[400px] text-xs">
        <thead>
          <tr className="text-petroleum-400 text-left">
            <th className="pb-2 pr-4 font-medium">Price ID</th>
            <th className="pb-2 pr-4 font-medium">Amount</th>
            <th className="pb-2 pr-4 font-medium">Status</th>
            <th className="pb-2 pr-4 font-medium">Created</th>
            <th className="pb-2 font-medium text-right">Members</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-sand-100 border-t">
              <td className="text-petroleum-400 py-2 pr-4 font-mono">
                {r.id.slice(0, 20)}…
              </td>
              <td className="text-petroleum-600 py-2 pr-4">
                {r.unit_amount != null
                  ? intl.format(r.unit_amount / 100)
                  : "—"}
                {" / mo"}
              </td>
              <td className="py-2 pr-4">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    r.active
                      ? "bg-green-50 text-green-700"
                      : "bg-sand-100 text-petroleum-400"
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${r.active ? "bg-green-500" : "bg-petroleum-300"}`}
                  />
                  {r.active ? "Active" : "Archived"}
                </span>
              </td>
              <td className="text-petroleum-400 py-2 pr-4">
                {formatDate(r.created)}
              </td>
              <td className="text-petroleum-600 py-2 text-right font-medium">
                {r.memberCount != null ? r.memberCount : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PlansTabContent({
  plans,
  onEdit,
  onReload,
}: {
  plans: PlanRow[];
  onEdit: (plan: PlanRow) => void;
  onReload: () => Promise<void>;
}) {
  const [localPlans, setLocalPlans] = useState(plans);

  // Keep in sync with parent
  if (plans !== localPlans && plans.length > 0) setLocalPlans(plans);

  function handleSynced(
    updated: Pick<PlanRow, "id" | "stripe_product_id" | "stripe_price_id">,
  ) {
    setLocalPlans((prev) =>
      prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)),
    );
  }

  return (
    <div className="border-sand-200 rounded-2xl border bg-white">
      {/* Header */}
      <div className="border-sand-100 border-b px-6 py-4">
        <h2 className="text-petroleum-700 text-sm font-semibold">
          Membership Plans
        </h2>
      </div>

      {/* Plan cards */}
      <div className="space-y-2 p-4">
        {localPlans.map((plan) => (
          <div key={plan.id}>
            <PlanCard
              plan={plan}
              onEdit={() => onEdit(plan)}
              onSynced={handleSynced}
            />

            {/* Price history — only when synced */}
            {plan.stripe_product_id && (
              <PriceHistoryTable
                productId={plan.stripe_product_id}
                planLabel={plan.label}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
