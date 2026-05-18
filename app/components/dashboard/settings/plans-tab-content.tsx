"use client";

import { useState, useEffect } from "react";
import type { PlanRow } from "@/types/settings";
import {
  syncAllPlansToStripe,
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

function priceNeedsSync(plan: PlanRow): boolean {
  if (!plan.stripe_price_id) return true;
  if (plan.stripe_synced_price == null) return true;
  return (
    Math.abs(Number(plan.price_monthly) - Number(plan.stripe_synced_price)) >
    0.001
  );
}

// ─── Plan Card (column) ───────────────────────────────────────

function PlanCard({ plan, onEdit }: { plan: PlanRow; onEdit: () => void }) {
  const isSynced = !!plan.stripe_price_id;
  const needsSync = priceNeedsSync(plan);
  const priceChanged = isSynced && needsSync;

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
            ? `€${plan.price_monthly} / mo`
            : "No price set"}
        </span>
      </button>

      {/* Sync status */}
      <div className="mt-3">
        {isSynced && !priceChanged ? (
          <span className="text-xs font-medium text-green-600">Synced ✓</span>
        ) : priceChanged ? (
          <span className="text-xs font-medium text-amber-600">
            Price changed
          </span>
        ) : (
          <span className="text-petroleum-400 text-xs">Not synced</span>
        )}
      </div>
    </div>
  );
}

// ─── Price History Card ───────────────────────────────────────

type HistoryRow = StripePriceEntry & {
  memberCount?: number;
  planLabel: string;
};

type HistoryState = { rows: HistoryRow[]; loading: boolean };

function PriceHistoryCard({ plans }: { plans: PlanRow[] }) {
  const [{ rows, loading }, setHistory] = useState<HistoryState>({
    rows: [],
    loading: true,
  });

  const syncedPlans = plans.filter((p) => p.stripe_product_id);

  useEffect(() => {
    if (syncedPlans.length === 0) {
      setHistory({ rows: [], loading: false });
      return;
    }

    const allRows: HistoryRow[] = [];
    Promise.all(
      syncedPlans.map(async (plan) => {
        const [prices, memberCount] = await Promise.all([
          getPlanPriceHistory(plan.stripe_product_id!),
          getPlanMemberCount(plan.label),
        ]);
        for (const p of prices) {
          allRows.push({
            ...p,
            planLabel: plan.label,
            memberCount: p.active ? memberCount : undefined,
          });
        }
      }),
    ).then(() => {
      allRows.sort((a, b) => b.created - a.created);
      setHistory({ rows: allRows, loading: false });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncedPlans.length]);

  if (syncedPlans.length === 0) return null;

  return (
    <div className="border-sand-200 rounded-2xl border bg-white">
      <div className="border-sand-100 border-b px-6 py-4">
        <h2 className="text-petroleum-700 text-sm font-semibold">
          Price History
        </h2>
      </div>

      {loading ? (
        <div className="space-y-2 p-4">
          {(["a", "b", "c"] as const).map((k) => (
            <div key={k} className="bg-sand-100 h-8 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : !rows?.length ? (
        <p className="text-petroleum-400 p-6 text-xs">
          No prices found in Stripe.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-xs">
            <thead>
              <tr className="text-petroleum-400 border-sand-100 border-b text-left">
                <th className="px-5 py-3 font-medium">Plan</th>
                <th className="px-5 py-3 font-medium">Price ID</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Created</th>
                <th className="px-5 py-3 text-right font-medium">Members</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-sand-100 border-t">
                  <td className="text-petroleum-500 px-5 py-3 font-medium capitalize">
                    {r.planLabel}
                  </td>
                  <td className="text-petroleum-400 px-5 py-3 font-mono">
                    {r.id.slice(0, 18)}…
                  </td>
                  <td className="text-petroleum-600 px-5 py-3">
                    {r.unit_amount != null
                      ? intl.format(r.unit_amount / 100)
                      : "—"}
                    {" / mo"}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
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
                  <td className="text-petroleum-400 px-5 py-3">
                    {formatDate(r.created)}
                  </td>
                  <td className="text-petroleum-600 px-5 py-3 text-right font-medium">
                    {r.memberCount != null ? r.memberCount : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Plans Tab Content ────────────────────────────────────────

export function PlansTabContent({
  plans,
  onEdit,
  onReload,
}: {
  plans: PlanRow[];
  onEdit: (plan: PlanRow) => void;
  onReload: () => Promise<void>;
}) {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    synced: number;
    errors: string[];
  } | null>(null);

  const anyNeedsSync = plans.some(priceNeedsSync);

  async function handleSyncChanged() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await syncAllPlansToStripe();
      await onReload();
      setSyncResult({
        synced: result.synced.length,
        errors: result.errors.map((e) => `${e.label}: ${e.error}`),
      });
    } catch (err) {
      setSyncResult({
        synced: 0,
        errors: [err instanceof Error ? err.message : "Sync failed"],
      });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Plans card */}
      <div className="border-sand-200 rounded-2xl border bg-white">
        {/* Header */}
        <div className="border-sand-100 flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-petroleum-700 text-sm font-semibold">
            Membership Plans
          </h2>

          {anyNeedsSync && (
            <button
              type="button"
              disabled={syncing}
              onClick={() => void handleSyncChanged()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#635BFF] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#5a52e8] disabled:opacity-50"
            >
              {syncing ? (
                <>
                  <span className="size-3 animate-spin rounded-full border-2 border-white/30 border-t-current" />
                  Syncing…
                </>
              ) : (
                "Sync to Stripe"
              )}
            </button>
          )}
        </div>

        {/* Sync feedback */}
        {syncResult && (
          <div
            className={`border-sand-100 border-b px-6 py-2.5 text-xs ${
              syncResult.errors.length > 0 ? "text-red-600" : "text-green-600"
            }`}
          >
            {syncResult.errors.length === 0 ? (
              <>
                ✓ {syncResult.synced} plan{syncResult.synced !== 1 ? "s" : ""}{" "}
                synced
              </>
            ) : (
              <>
                {syncResult.synced > 0 && <>{syncResult.synced} synced. </>}
                {syncResult.errors.join("; ")}
              </>
            )}
          </div>
        )}

        {/* 3-column grid on desktop */}
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onEdit={() => onEdit(plan)} />
          ))}
        </div>
      </div>

      {/* Price history card (auto-loaded) */}
      <PriceHistoryCard plans={plans} />
    </div>
  );
}
