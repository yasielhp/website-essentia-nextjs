"use client";

import { useEffect, useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/dashboard/pagination";
import { StatCard } from "@/components/dashboard/calendar/stat-card";

type Member = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  plan: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

const PAGE_SIZE = 20;

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  expired: "bg-sand-100 text-petroleum-400",
  cancelled: "bg-red-50 text-red-500",
};

const PLAN_STYLES: Record<string, string> = {
  essential: "bg-sand-100 text-petroleum-500",
  premium: "bg-blue-50 text-blue-700",
  founder: "bg-purple-50 text-purple-700",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconFilter() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 6h16M7 12h10M10 18h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

const fieldCls =
  "border-sand-200 text-petroleum-500 placeholder:text-petroleum-300 w-full rounded-xl border bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-petroleum-300";

type MemberFilter = { status: string; plan: string };
const emptyMemberFilter: MemberFilter = { status: "", plan: "" };

type ListState = {
  members: Member[];
  loading: boolean;
  total: number;
  activeCount: number | null;
};

type ListAction =
  | { type: "loading" }
  | {
      type: "loaded";
      members: Member[];
      total: number;
      activeCount?: number | null;
    };

function listReducer(state: ListState, action: ListAction): ListState {
  if (action.type === "loading") return { ...state, loading: true };
  return {
    loading: false,
    members: action.members,
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
  pending: MemberFilter;
  onChange: (key: keyof MemberFilter, value: string) => void;
  onApply: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-sm flex-col gap-5 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-petroleum-700 text-xl">Filters</h3>
          <button
            onClick={onClose}
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
              Status
            </span>
            <select
              value={pending.status}
              onChange={(e) => onChange("status", e.target.value)}
              className={fieldCls}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-petroleum-400 text-xs font-medium">Plan</span>
            <select
              value={pending.plan}
              onChange={(e) => onChange("plan", e.target.value)}
              className={fieldCls}
            >
              <option value="">All plans</option>
              <option value="essential">Essential</option>
              <option value="premium">Premium</option>
              <option value="founder">Founder</option>
            </select>
          </label>
        </div>
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={onClear}
            className="text-petroleum-400 hover:text-petroleum-700 text-sm transition-colors"
          >
            Clear all
          </button>
          <Button variant="solid" size="md" onClick={onApply}>
            Apply filters
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function MembersPage() {
  const [state, dispatch] = useReducer(listReducer, {
    members: [],
    loading: true,
    total: 0,
    activeCount: null,
  });
  const { members, loading, total, activeCount } = state;
  const [page, setPage] = useState(0);
  const [appliedFilter, setAppliedFilter] =
    useState<MemberFilter>(emptyMemberFilter);
  const [pendingFilter, setPendingFilter] =
    useState<MemberFilter>(emptyMemberFilter);
  const [filterOpen, setFilterOpen] = useState(false);
  const { push } = useRouter();

  const activeFilterCount =
    (appliedFilter.status ? 1 : 0) + (appliedFilter.plan ? 1 : 0);

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
    setPendingFilter(emptyMemberFilter);
    setAppliedFilter(emptyMemberFilter);
    setPage(0);
    setFilterOpen(false);
  }

  useEffect(() => {
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

      dispatch({
        type: "loaded",
        members: (listRes.data as Member[] | null) ?? [],
        total: listRes.count ?? 0,
        activeCount:
          activeRes && "count" in activeRes
            ? ((activeRes as { count: number | null }).count ?? 0)
            : undefined,
      });
    }
    void run();
  }, [page, appliedFilter]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="px-6 py-8 lg:px-10">
      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4">
        <StatCard
          label="Active Members"
          value={activeCount ?? 0}
          loading={activeCount === null}
        />
        <StatCard
          label="Total Members"
          value={total}
          loading={loading && total === 0}
        />
      </div>

      {/* Header */}
      <div className="mb-8 flex items-center justify-between gap-3">
        <Button
          onClick={() => push("/dashboard/members/new")}
          className="flex items-center gap-2"
        >
          <IconPlus />
          New Member
        </Button>
        <Button
          variant={activeFilterCount > 0 ? "soft" : "outline"}
          size="md"
          onClick={openModal}
          className="gap-2"
        >
          <IconFilter />
          Filters{activeFilterCount > 0 ? ` [${activeFilterCount}]` : ""}
        </Button>
      </div>

      {/* Table */}
      <div className="border-sand-200 overflow-hidden rounded-2xl border bg-white">
        {loading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-sand-100 h-10 animate-pulse rounded-xl"
              />
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="text-petroleum-300 py-20 text-center text-sm">
            No members yet.
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-sand-100 border-b">
                    <th className="text-petroleum-400 px-5 py-3 text-left text-xs font-medium">
                      Name
                    </th>
                    <th className="text-petroleum-400 px-5 py-3 text-left text-xs font-medium">
                      Contact
                    </th>
                    <th className="text-petroleum-400 px-5 py-3 text-left text-xs font-medium">
                      Plan
                    </th>
                    <th className="text-petroleum-400 px-5 py-3 text-left text-xs font-medium">
                      Status
                    </th>
                    <th className="text-petroleum-400 px-5 py-3 text-left text-xs font-medium">
                      Start
                    </th>
                    <th className="text-petroleum-400 px-5 py-3 text-left text-xs font-medium">
                      Expires
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr
                      key={m.id}
                      onClick={() => push(`/dashboard/members/${m.id}`)}
                      className="border-sand-100 hover:bg-sand-50 cursor-pointer border-b transition-colors last:border-0"
                    >
                      <td className="text-petroleum-700 px-5 py-3.5 font-medium">
                        {m.first_name} {m.last_name}
                      </td>
                      <td className="text-petroleum-500 px-5 py-3.5">
                        <div>{m.email ?? "—"}</div>
                        {m.phone && (
                          <div className="text-petroleum-400 text-xs">
                            {m.phone}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${PLAN_STYLES[m.plan] ?? "bg-sand-100 text-petroleum-500"}`}
                        >
                          {m.plan}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[m.status] ?? "bg-sand-100 text-petroleum-400"}`}
                        >
                          {m.status}
                        </span>
                      </td>
                      <td className="text-petroleum-500 px-5 py-3.5 text-xs">
                        {formatDate(m.start_date)}
                      </td>
                      <td className="text-petroleum-500 px-5 py-3.5 text-xs">
                        {formatDate(m.end_date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="divide-sand-100 divide-y md:hidden">
              {members.map((m) => (
                <button
                  key={m.id}
                  onClick={() => push(`/dashboard/members/${m.id}`)}
                  className="hover:bg-sand-50 flex w-full items-center justify-between px-5 py-4 text-left transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-petroleum-700 truncate font-medium">
                      {m.first_name} {m.last_name}
                    </p>
                    <p className="text-petroleum-400 truncate text-xs">
                      {m.email ?? m.phone ?? "—"}
                    </p>
                  </div>
                  <div className="ml-4 flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLES[m.status] ?? "bg-sand-100 text-petroleum-400"}`}
                    >
                      {m.status}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${PLAN_STYLES[m.plan] ?? "bg-sand-100 text-petroleum-500"}`}
                    >
                      {m.plan}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <Pagination
              page={page}
              totalPages={totalPages}
              onPage={setPage}
              loading={loading}
            />
          </>
        )}
      </div>

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
