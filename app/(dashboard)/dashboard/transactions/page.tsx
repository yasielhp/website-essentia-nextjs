"use client";

import { useEffect, useState } from "react";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/dashboard/pagination";

// ─── Source row types ─────────────────────────────────────────

type BookingRow = {
  id: string;
  service_title: string | null;
  first_name: string | null;
  last_name: string | null;
  date: string | null;
  status: string | null;
  payment_status: string | null;
  price_eur: number | null;
  created_at: string | null;
};

type MembershipRow = {
  id: string;
  contact_id: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string | null;
  contacts?: { first_name: string | null; last_name: string | null } | null;
};

type RaceRegistrationRow = {
  id: string;
  contact_id: string | null;
  race_id: string | null;
  created_at: string | null;
  races?: { title: string | null } | null;
  contacts?: { first_name: string | null; last_name: string | null } | null;
};

type EducationRegistrationRow = {
  id: string;
  contact_id: string | null;
  session_id: string | null;
  created_at: string | null;
  education_sessions?: { title: string | null } | null;
  contacts?: { first_name: string | null; last_name: string | null } | null;
};

// ─── Unified row ──────────────────────────────────────────────

type TxType = "booking" | "membership" | "race" | "education";

type UnifiedRow = {
  id: string;
  type: TxType;
  title: string;
  client: string;
  date: string | null;
  amount: number | null;
  status: string | null;
  created_at: string | null;
};

// ─── Constants ────────────────────────────────────────────────

const TYPE_BADGE: Record<TxType, { label: string; cls: string }> = {
  booking: { label: "Booking", cls: "bg-blue-100 text-blue-700" },
  membership: { label: "Membership", cls: "bg-purple-50 text-purple-700" },
  race: { label: "Race", cls: "bg-green-50 text-green-700" },
  education: { label: "Education", cls: "bg-yellow-50 text-yellow-700" },
};

const STATUS_CLS: Record<string, string> = {
  paid: "bg-green-50 text-green-700",
  confirmed: "bg-green-50 text-green-700",
  active: "bg-green-50 text-green-700",
  pending: "bg-yellow-50 text-yellow-700",
  failed: "bg-red-50 text-red-600",
  cancelled: "bg-red-50 text-red-600",
  expired: "bg-red-50 text-red-600",
  refunded: "bg-yellow-50 text-yellow-700",
};

const PAGE_SIZE = 20;

// ─── Filter ───────────────────────────────────────────────────

const fieldCls =
  "border-sand-200 text-petroleum-500 placeholder:text-petroleum-300 w-full rounded-xl border bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-petroleum-300";

type TxFilter = { type: string; status: string };
const emptyTxFilter: TxFilter = { type: "", status: "" };

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

function FilterModal({
  pending,
  onChange,
  onApply,
  onClear,
  onClose,
}: {
  pending: TxFilter;
  onChange: (key: keyof TxFilter, value: string) => void;
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
            <span className="text-petroleum-400 text-xs font-medium">Type</span>
            <select
              value={pending.type}
              onChange={(e) => onChange("type", e.target.value)}
              className={fieldCls}
            >
              <option value="">All types</option>
              <option value="booking">Booking</option>
              <option value="membership">Membership</option>
              <option value="race">Race</option>
              <option value="education">Education</option>
            </select>
          </label>
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
              <option value="confirmed">Confirmed</option>
              <option value="active">Active</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
              <option value="expired">Expired</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
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

// ─── Helpers ──────────────────────────────────────────────────

function fullName(
  c: { first_name: string | null; last_name: string | null } | null | undefined,
  fallback: string | null,
): string {
  if (c) {
    const n = [c.first_name, c.last_name].filter(Boolean).join(" ");
    if (n) return n;
  }
  return fallback ? `${fallback.slice(0, 8)}…` : "—";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

const intlCurrency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "EUR",
});

function formatAmount(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "—";
  return intlCurrency.format(value);
}

function StatusBadge({ status }: { status: string | null }) {
  const s = status ?? "unknown";
  const cls = STATUS_CLS[s] ?? "bg-sand-100 text-petroleum-500";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${cls}`}
    >
      {s}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function TransactionsPage() {
  const [rows, setRows] = useState<UnifiedRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [appliedFilter, setAppliedFilter] = useState<TxFilter>(emptyTxFilter);
  const [pendingFilter, setPendingFilter] = useState<TxFilter>(emptyTxFilter);
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(0);
  const activeFilterCount = Object.values(appliedFilter).filter(Boolean).length;

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
    setAppliedFilter(emptyTxFilter);
    setPendingFilter(emptyTxFilter);
    setPage(0);
    setFilterOpen(false);
  }

  useEffect(() => {
    async function load() {
      const [bookingsRes, membersRes, racesRes, educationRes] =
        await Promise.all([
          insforge.database
            .from("bookings")
            .select(
              "id, service_title, first_name, last_name, date, status, payment_status, price_eur, created_at",
            )
            .order("created_at", { ascending: false })
            .limit(100),
          insforge.database
            .from("memberships")
            .select(
              "id, contact_id, status, start_date, end_date, created_at, contacts(first_name, last_name)",
            )
            .order("created_at", { ascending: false })
            .limit(100),
          insforge.database
            .from("race_registrations")
            .select(
              "id, contact_id, race_id, created_at, races(title), contacts(first_name, last_name)",
            )
            .order("created_at", { ascending: false })
            .limit(100),
          insforge.database
            .from("education_registrations")
            .select(
              "id, contact_id, session_id, created_at, education_sessions(title), contacts(first_name, last_name)",
            )
            .order("created_at", { ascending: false })
            .limit(100),
        ]);

      const unified: UnifiedRow[] = [];

      for (const r of (bookingsRes.data as BookingRow[] | null) ?? []) {
        unified.push({
          id: r.id,
          type: "booking",
          title: r.service_title ?? "—",
          client: [r.first_name, r.last_name].filter(Boolean).join(" ") || "—",
          date: r.date,
          amount: r.price_eur,
          status: r.payment_status ?? r.status,
          created_at: r.created_at,
        });
      }

      for (const r of (membersRes.data as MembershipRow[] | null) ?? []) {
        unified.push({
          id: r.id,
          type: "membership",
          title: "Membership",
          client: fullName(r.contacts, r.contact_id),
          date: r.start_date,
          amount: null,
          status: r.status,
          created_at: r.created_at,
        });
      }

      for (const r of (racesRes.data as RaceRegistrationRow[] | null) ?? []) {
        unified.push({
          id: r.id,
          type: "race",
          title:
            r.races?.title ?? (r.race_id ? `${r.race_id.slice(0, 8)}…` : "—"),
          client: fullName(r.contacts, r.contact_id),
          date: r.created_at,
          amount: null,
          status: "confirmed",
          created_at: r.created_at,
        });
      }

      for (const r of (educationRes.data as
        | EducationRegistrationRow[]
        | null) ?? []) {
        unified.push({
          id: r.id,
          type: "education",
          title:
            r.education_sessions?.title ??
            (r.session_id ? `${r.session_id.slice(0, 8)}…` : "—"),
          client: fullName(r.contacts, r.contact_id),
          date: r.created_at,
          amount: null,
          status: "confirmed",
          created_at: r.created_at,
        });
      }

      unified.sort((a, b) => {
        if (!a.created_at) return 1;
        if (!b.created_at) return -1;
        return b.created_at.localeCompare(a.created_at);
      });

      setRows(unified);
      setLoading(false);
    }
    void load();
  }, []);

  const filteredRows = rows.filter((r) => {
    if (appliedFilter.type && r.type !== appliedFilter.type) return false;
    if (appliedFilter.status && r.status !== appliedFilter.status) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pageRows = filteredRows.slice(
    page * PAGE_SIZE,
    page * PAGE_SIZE + PAGE_SIZE,
  );

  return (
    <div className="px-6 py-8 lg:px-10">
      {/* Header */}
      <div className="mb-6 flex justify-end">
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

      {/* ── Mobile cards ── */}
      <div className="sm:hidden">
        {loading ? (
          <div className="divide-sand-200 border-sand-200 divide-y overflow-hidden rounded-2xl border bg-white">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2 px-4 py-4">
                <div className="flex items-center gap-2">
                  <div className="bg-sand-100 h-4 w-20 animate-pulse rounded-full" />
                  <div className="bg-sand-100 h-4 w-16 animate-pulse rounded-full" />
                </div>
                <div className="bg-sand-100 h-4 w-40 animate-pulse rounded" />
                <div className="bg-sand-100 h-3 w-28 animate-pulse rounded" />
              </div>
            ))}
          </div>
        ) : pageRows.length === 0 ? (
          <p className="text-petroleum-400 py-12 text-center text-sm">
            No transactions found.
          </p>
        ) : (
          <div className="divide-sand-200 border-sand-200 divide-y overflow-hidden rounded-2xl border bg-white">
            {pageRows.map((row) => {
              const tb = TYPE_BADGE[row.type];
              return (
                <div key={row.id} className="px-4 py-4">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tb.cls}`}
                    >
                      {tb.label}
                    </span>
                    <StatusBadge status={row.status} />
                  </div>
                  <p className="text-petroleum-700 mt-1.5 leading-snug font-medium">
                    {row.title}
                  </p>
                  <p className="text-petroleum-400 mt-0.5 text-sm">
                    {row.client}
                  </p>
                  <div className="mt-1.5 flex items-center gap-3">
                    {row.created_at && (
                      <span className="text-petroleum-300 text-xs">
                        {formatDate(row.created_at)}
                      </span>
                    )}
                    {row.amount !== null && (
                      <span className="text-petroleum-700 text-xs font-medium">
                        {formatAmount(row.amount)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Desktop table ── */}
      <div className="hidden sm:block">
        <div className="border-sand-200 rounded-2xl border bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-sand-200 border-b text-left">
                  <th className="text-petroleum-400 px-5 py-3.5 text-xs font-medium">
                    Created
                  </th>
                  <th className="text-petroleum-400 px-5 py-3.5 text-xs font-medium">
                    Status
                  </th>
                  <th className="text-petroleum-400 px-5 py-3.5 text-xs font-medium">
                    Type
                  </th>
                  <th className="text-petroleum-400 px-5 py-3.5 text-xs font-medium">
                    Title
                  </th>
                  <th className="text-petroleum-400 px-5 py-3.5 text-xs font-medium">
                    Client
                  </th>
                  <th className="text-petroleum-400 px-5 py-3.5 text-right text-xs font-medium">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-sand-50 border-b">
                      {/* Created */}
                      <td className="px-5 py-4"><div className="bg-sand-100 h-4 w-24 animate-pulse rounded" /></td>
                      {/* Status */}
                      <td className="px-5 py-4"><div className="bg-sand-100 h-5 w-20 animate-pulse rounded-full" /></td>
                      {/* Type */}
                      <td className="px-5 py-4"><div className="bg-sand-100 h-5 w-20 animate-pulse rounded-full" /></td>
                      {/* Title */}
                      <td className="px-5 py-4"><div className="bg-sand-100 h-4 w-40 animate-pulse rounded" /></td>
                      {/* Client */}
                      <td className="px-5 py-4"><div className="bg-sand-100 h-4 w-32 animate-pulse rounded" /></td>
                      {/* Amount (right-aligned) */}
                      <td className="px-5 py-4 text-right"><div className="bg-sand-100 ml-auto h-4 w-16 animate-pulse rounded" /></td>
                    </tr>
                  ))
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-petroleum-400 px-6 py-12 text-center"
                    >
                      No transactions found.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row) => {
                    const tb = TYPE_BADGE[row.type];
                    return (
                      <tr
                        key={row.id}
                        className="border-sand-50 hover:bg-sand-50 border-b transition-colors"
                      >
                        <td className="text-petroleum-400 px-5 py-4">
                          {formatDate(row.created_at)}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tb.cls}`}
                          >
                            {tb.label}
                          </span>
                        </td>
                        <td className="text-petroleum-700 px-5 py-4 font-medium">
                          {row.title}
                        </td>
                        <td className="text-petroleum-500 px-5 py-4">
                          {row.client}
                        </td>
                        <td className="text-petroleum-700 px-5 py-4 text-right font-medium">
                          {formatAmount(row.amount)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {filteredRows.length > PAGE_SIZE && (
        <div className="border-sand-200 mt-4 rounded-2xl border bg-white">
          <Pagination
            page={page}
            totalPages={totalPages}
            onPage={setPage}
            loading={loading}
            className="border-t-0"
          />
        </div>
      )}

      {filterOpen && (
        <FilterModal
          pending={pendingFilter}
          onChange={(key, val) =>
            setPendingFilter((p) => ({ ...p, [key]: val }))
          }
          onApply={applyFilters}
          onClear={clearFilters}
          onClose={() => setFilterOpen(false)}
        />
      )}
    </div>
  );
}
