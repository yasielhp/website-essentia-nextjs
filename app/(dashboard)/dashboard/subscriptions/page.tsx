"use client";

import { useEffect, useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { insforge } from "@/lib/insforge";
import { useDashboardLocale } from "@/hooks/use-dashboard-locale";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/calendar/stat-card";
import { IconPlus, IconFilter } from "@/components/ui/icons";
import { SubscriptionTable } from "./subscription-table";
import type { Subscription } from "./types";

const PAGE_SIZE = 20;

const fieldCls =
  "border-sand-200 text-petroleum-500 placeholder:text-petroleum-300 w-full rounded-xl border bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-petroleum-300";

type SubscriptionFilter = { status: string; plan: string };
const emptySubscriptionFilter: SubscriptionFilter = { status: "", plan: "" };

type ListState = {
  subscriptions: Subscription[];
  loading: boolean;
  total: number;
  activeCount: number | null;
};

type ListAction =
  | { type: "loading" }
  | {
      type: "loaded";
      subscriptions: Subscription[];
      total: number;
      activeCount?: number | null;
    };

function listReducer(state: ListState, action: ListAction): ListState {
  if (action.type === "loading") return { ...state, loading: true };
  return {
    loading: false,
    subscriptions: action.subscriptions,
    total: action.total,
    activeCount: action.activeCount ?? state.activeCount,
  };
}

function FilterModal({
  pending,
  onChange,
  onApply,
  onClear,
  onClose,
}: {
  pending: SubscriptionFilter;
  onChange: (key: keyof SubscriptionFilter, value: string) => void;
  onApply: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("dashboard");
  return (
    <div
      // Decorative: the click that closes is a convenience for a mouse. The
      // dialog itself is the element inside, and Escape closes it too.
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-sm flex-col gap-5 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-petroleum-700 text-xl">
            {t("common.filters")}
          </h3>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            className="text-petroleum-300 hover:text-petroleum-500 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 6 6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-petroleum-400 text-xs font-medium">
              {t("subscriptions.filters.status")}
            </span>
            <select
              value={pending.status}
              onChange={(e) => onChange("status", e.target.value)}
              className={fieldCls}
            >
              <option value="">{t("subscriptions.filters.allStatuses")}</option>
              <option value="active">{t("subscriptions.status.active")}</option>
              <option value="expired">
                {t("subscriptions.status.expired")}
              </option>
              <option value="cancelled">
                {t("subscriptions.status.cancelled")}
              </option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-petroleum-400 text-xs font-medium">
              {t("subscriptions.filters.plan")}
            </span>
            <select
              value={pending.plan}
              onChange={(e) => onChange("plan", e.target.value)}
              className={fieldCls}
            >
              <option value="">{t("subscriptions.filters.allPlans")}</option>
              <option value="essential">
                {t("subscriptions.plans.essential")}
              </option>
              <option value="premium">
                {t("subscriptions.plans.premium")}
              </option>
              <option value="founder">
                {t("subscriptions.plans.founder")}
              </option>
            </select>
          </label>
        </div>
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={onClear}
            className="text-petroleum-400 hover:text-petroleum-700 text-sm transition-colors"
          >
            {t("common.clearAll")}
          </button>
          <Button variant="solid" size="md" onClick={onApply}>
            {t("common.applyFilters")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function SubscriptionsPage() {
  const t = useTranslations("dashboard");
  const locale = useDashboardLocale();
  const [state, dispatch] = useReducer(listReducer, {
    subscriptions: [],
    loading: true,
    total: 0,
    activeCount: null,
  });
  const { subscriptions, loading, total, activeCount } = state;
  const [page, setPage] = useState(0);
  const [appliedFilter, setAppliedFilter] = useState<SubscriptionFilter>(
    emptySubscriptionFilter,
  );
  const [pendingFilter, setPendingFilter] = useState<SubscriptionFilter>(
    emptySubscriptionFilter,
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const { push } = useRouter();

  const activeFilterCount =
    (appliedFilter.status ? 1 : 0) + (appliedFilter.plan ? 1 : 0);

  // Plans and statuses come from the database, so an unmapped value is possible.
  const planLabel = (plan: string) =>
    t.has(`subscriptions.plans.${plan}`)
      ? t(`subscriptions.plans.${plan}`)
      : plan;
  const statusLabel = (status: string) =>
    t.has(`subscriptions.status.${status}`)
      ? t(`subscriptions.status.${status}`)
      : status;

  function openModal() {
    setPendingFilter(appliedFilter);
    setFilterOpen(true);
  }

  function applyFilters() {
    setAppliedFilter(pendingFilter);
    setPage(0);
    setFilterOpen(false);
  }

  function clearFilters() {
    setPendingFilter(emptySubscriptionFilter);
    setAppliedFilter(emptySubscriptionFilter);
    setPage(0);
    setFilterOpen(false);
  }

  useEffect(() => {
    let cancelled = false;

    dispatch({ type: "loading" });
    async function run() {
      let listQuery = insforge.database
        .from("memberships")
        .select(
          "id, first_name, last_name, email, phone, plan, status, start_date, end_date, created_at",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (appliedFilter.status)
        listQuery = listQuery.eq("status", appliedFilter.status);
      if (appliedFilter.plan)
        listQuery = listQuery.eq("plan", appliedFilter.plan);

      const [listRes, activeRes] = await Promise.all([
        listQuery,
        page === 0
          ? insforge.database
              .from("memberships")
              .select("id", { count: "exact", head: true })
              .eq("status", "active")
          : Promise.resolve(null),
      ]);

      if (cancelled) return;

      dispatch({
        type: "loaded",
        subscriptions: (listRes.data as Subscription[] | null) ?? [],
        total: listRes.count ?? 0,
        activeCount:
          activeRes && "count" in activeRes
            ? ((activeRes as { count: number | null }).count ?? 0)
            : undefined,
      });
    }
    void run();

    return () => {
      cancelled = true;
    };
  }, [page, appliedFilter]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="px-6 py-8 lg:px-10">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <Button
          onClick={() => push("/dashboard/subscriptions/new")}
          className="flex items-center gap-2"
        >
          <IconPlus />
          {t("subscriptions.newSubscription")}
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant={activeFilterCount > 0 ? "soft" : "outline"}
            size="md"
            onClick={openModal}
            className="gap-2"
          >
            <IconFilter />
            {activeFilterCount > 0
              ? t("common.filtersWithCount", { count: activeFilterCount })
              : t("common.filters")}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4">
        <StatCard
          label={t("subscriptions.stats.active")}
          value={activeCount ?? 0}
          loading={activeCount === null}
        />
        <StatCard
          label={t("subscriptions.stats.total")}
          value={total}
          loading={loading && total === 0}
        />
      </div>

      {/* Table */}
      <SubscriptionTable
        subscriptions={subscriptions}
        loading={loading}
        page={page}
        totalPages={totalPages}
        onPage={setPage}
        onOpen={(id) => push(`/dashboard/subscriptions/${id}`)}
        locale={locale}
        planLabel={planLabel}
        statusLabel={statusLabel}
      />

      {filterOpen && (
        <FilterModal
          pending={pendingFilter}
          onChange={(key, value) =>
            setPendingFilter((prev) => ({ ...prev, [key]: value }))
          }
          onApply={applyFilters}
          onClear={clearFilters}
          onClose={() => setFilterOpen(false)}
        />
      )}
    </div>
  );
}
