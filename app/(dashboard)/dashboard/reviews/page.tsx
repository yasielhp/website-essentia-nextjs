"use client";

import { useEffect, useReducer, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/dashboard/pagination";
import { StatCard } from "@/components/dashboard/calendar/stat-card";
import { IconPlus, IconFilter } from "@/components/ui/icons";
import { formatMediumDate } from "@/utils/format";
import { useDashboardLocale } from "@/hooks/use-dashboard-locale";

type Review = {
  id: string;
  quote: string;
  name: string;
  age: string;
  initials: string;
  display_order: number;
  status: "draft" | "published";
  created_at: string;
};

const PAGE_SIZE = 10;

// ─── Badges ───────────────────────────────────────────────────

const statusBadgeClasses: Record<string, string> = {
  published: "bg-green-100 text-green-800",
  draft: "bg-yellow-100 text-yellow-800",
};

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("dashboard.reviews");
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadgeClasses[status] ?? "bg-sand-100 text-petroleum-500"}`}
    >
      {t.has(`status.${status}`) ? t(`status.${status}`) : status}
    </span>
  );
}

function Avatar({ initials }: { initials: string }) {
  return (
    <div className="bg-petroleum-100 text-petroleum-700 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium">
      {initials}
    </div>
  );
}

// ─── Filter modal ─────────────────────────────────────────────

function FilterModal({
  pending,
  onChange,
  onApply,
  onClear,
  onClose,
}: {
  pending: string;
  onChange: (value: string) => void;
  onApply: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("dashboard");
  const fieldCls =
    "border-sand-200 text-petroleum-500 placeholder:text-petroleum-300 w-full rounded-xl border bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-petroleum-300";

  return (
    <div
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

        <label className="flex flex-col gap-1.5">
          <span className="text-petroleum-400 text-xs font-medium">
            {t("reviews.filters.status")}
          </span>
          <select
            value={pending}
            onChange={(e) => onChange(e.target.value)}
            className={fieldCls}
          >
            <option value="">{t("reviews.filters.allStatuses")}</option>
            <option value="published">{t("reviews.status.published")}</option>
            <option value="draft">{t("reviews.status.draft")}</option>
          </select>
        </label>

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

// ─── State ────────────────────────────────────────────────────

type PageState = {
  reviews: Review[];
  total: number;
  page: number;
  loading: boolean;
};

type PageAction =
  | { type: "LOAD_SUCCESS"; reviews: Review[]; total: number }
  | { type: "SET_LOADING" }
  | { type: "SET_PAGE"; value: number }
  | { type: "RESET_PAGE" };

const initialState: PageState = {
  reviews: [],
  total: 0,
  page: 0,
  loading: true,
};

function reducer(state: PageState, action: PageAction): PageState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: true };
    case "LOAD_SUCCESS":
      return {
        ...state,
        loading: false,
        reviews: action.reviews,
        total: action.total,
      };
    case "SET_PAGE":
      return { ...state, page: action.value };
    case "RESET_PAGE":
      return { ...state, page: 0 };
  }
}

// ─── Page ─────────────────────────────────────────────────────

export default function ReviewsPage() {
  const t = useTranslations("dashboard");
  const locale = useDashboardLocale();
  const { push } = useRouter();
  const [state, dispatch] = useReducer(reducer, initialState);
  const { reviews, total, page, loading } = state;

  const [appliedStatus, setAppliedStatus] = useState("");
  const [pendingStatus, setPendingStatus] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  const [statusCounts, setStatusCounts] = useState<{
    published: number | null;
    draft: number | null;
  }>({ published: null, draft: null });

  // Stat counts (unaffected by current filter)
  useEffect(() => {
    void Promise.all([
      insforge.database
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("status", "published"),
      insforge.database
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("status", "draft"),
    ]).then(([pub, dra]) =>
      setStatusCounts({
        published: (pub as { count: number | null }).count ?? 0,
        draft: (dra as { count: number | null }).count ?? 0,
      }),
    );
  }, []);

  const fetchReviews = useCallback(async () => {
    dispatch({ type: "SET_LOADING" });
    let query = insforge.database
      .from("reviews")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (appliedStatus) query = query.eq("status", appliedStatus);

    const { data, count } = await query.range(
      page * PAGE_SIZE,
      page * PAGE_SIZE + PAGE_SIZE - 1,
    );

    dispatch({
      type: "LOAD_SUCCESS",
      reviews: (data as Review[] | null) ?? [],
      total: count ?? 0,
    });
  }, [page, appliedStatus]);

  useEffect(() => {
    void fetchReviews();
  }, [fetchReviews]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeCount = appliedStatus ? 1 : 0;

  function openModal() {
    setPendingStatus(appliedStatus);
    setFilterOpen(true);
  }

  function applyFilters() {
    setAppliedStatus(pendingStatus);
    dispatch({ type: "RESET_PAGE" });
    setFilterOpen(false);
  }

  function clearFilters() {
    setAppliedStatus("");
    setPendingStatus("");
    dispatch({ type: "RESET_PAGE" });
    setFilterOpen(false);
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <Button
          variant="solid"
          size="md"
          href="/dashboard/reviews/new"
          className="gap-2"
        >
          <IconPlus />
          {t("reviews.newReview")}
        </Button>
        <Button
          variant={activeCount > 0 ? "soft" : "outline"}
          size="md"
          onClick={openModal}
          className="gap-2"
        >
          <IconFilter />
          {activeCount > 0
            ? t("common.filtersWithCount", { count: activeCount })
            : t("common.filters")}
        </Button>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard
          label={t("reviews.stats.published")}
          value={statusCounts.published ?? 0}
          loading={statusCounts.published === null}
        />
        <StatCard
          label={t("reviews.stats.draft")}
          value={statusCounts.draft ?? 0}
          loading={statusCounts.draft === null}
        />
        <StatCard
          label={t("reviews.stats.total")}
          value={(statusCounts.published ?? 0) + (statusCounts.draft ?? 0)}
          loading={statusCounts.published === null}
        />
      </div>

      {/* Mobile cards */}
      <div className="border-sand-200 divide-sand-200 mb-4 divide-y rounded-2xl border bg-white sm:hidden">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="bg-sand-100 h-8 w-8 animate-pulse rounded-full" />
                <div>
                  <div className="bg-sand-100 h-4 w-24 animate-pulse rounded" />
                  <div className="bg-sand-100 mt-1 h-3 w-16 animate-pulse rounded" />
                </div>
              </div>
              <div className="bg-sand-100 mt-2 h-3 w-full animate-pulse rounded" />
            </div>
          ))
        ) : reviews.length === 0 ? (
          <p className="text-petroleum-400 px-6 py-12 text-center text-sm">
            {t("reviews.empty")}
          </p>
        ) : (
          reviews.map((r) => (
            <div key={r.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar initials={r.initials} />
                  <div className="min-w-0">
                    <p className="text-petroleum-700 truncate font-medium">
                      {r.name}
                    </p>
                    <p className="text-petroleum-400 text-xs">{r.age}</p>
                  </div>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <p className="text-petroleum-500 mt-2 line-clamp-2 text-sm italic">
                &ldquo;{r.quote}&rdquo;
              </p>
              <p className="text-petroleum-300 mt-1 text-xs">
                {formatMediumDate(r.created_at, locale)}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Table (desktop) */}
      <div className="border-sand-200 hidden rounded-2xl border bg-white sm:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-sand-200 border-b text-left">
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("reviews.columns.author")}
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("reviews.columns.quote")}
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("reviews.columns.status")}
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("reviews.columns.created")}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-sand-50 border-b">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-sand-100 h-8 w-8 animate-pulse rounded-full" />
                        <div>
                          <div className="bg-sand-100 h-4 w-24 animate-pulse rounded" />
                          <div className="bg-sand-100 mt-1 h-3 w-12 animate-pulse rounded" />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="bg-sand-100 h-4 w-64 animate-pulse rounded" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="bg-sand-100 h-5 w-20 animate-pulse rounded-full" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="bg-sand-100 h-4 w-20 animate-pulse rounded" />
                    </td>
                  </tr>
                ))
              ) : reviews.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="text-petroleum-400 px-6 py-12 text-center"
                  >
                    {t("reviews.empty")}
                  </td>
                </tr>
              ) : (
                reviews.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => push(`/dashboard/reviews/${r.id}`)}
                    className="border-sand-50 hover:bg-sand-50 cursor-pointer border-b transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar initials={r.initials} />
                        <div>
                          <p className="text-petroleum-700 font-medium">
                            {r.name}
                          </p>
                          <p className="text-petroleum-400 text-xs">{r.age}</p>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-xs px-5 py-4">
                      <p className="text-petroleum-500 line-clamp-2 italic">
                        &ldquo;{r.quote}&rdquo;
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="text-petroleum-400 px-5 py-4 text-sm">
                      {formatMediumDate(r.created_at, locale)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {total > PAGE_SIZE && (
        <div className="border-sand-200 mt-4 rounded-2xl border bg-white">
          <Pagination
            page={page}
            totalPages={totalPages}
            onPage={(p) => dispatch({ type: "SET_PAGE", value: p })}
            className="border-t-0"
            loading={loading}
          />
        </div>
      )}

      {filterOpen && (
        <FilterModal
          pending={pendingStatus}
          onChange={setPendingStatus}
          onApply={applyFilters}
          onClear={clearFilters}
          onClose={() => setFilterOpen(false)}
        />
      )}
    </div>
  );
}
