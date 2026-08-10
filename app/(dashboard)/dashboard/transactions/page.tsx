"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { dateFormatter, numberFormatter } from "@/utils/intl";
import { useLocale, useTranslations } from "next-intl";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/dashboard/pagination";
import { StatCard } from "@/components/dashboard/calendar/stat-card";
import { IconFilter } from "@/components/ui/icons";

// ─── Source row types ─────────────────────────────────────────

type BookingRow = {
  id: string;
  service_title: string | null;
  duration: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  created_by_role: string | null;
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
  subtitle: string | null;
  client: string;
  clientEmail: string | null;
  reservedBy: string | null;
  date: string | null;
  amount: number | null;
  status: string | null;
  created_at: string | null;
};

// ─── Constants ────────────────────────────────────────────────

const TYPE_BADGE: Record<TxType, { cls: string }> = {
  booking: { cls: "bg-blue-100 text-blue-700" },
  membership: { cls: "bg-purple-50 text-purple-700" },
  race: { cls: "bg-green-50 text-green-700" },
  education: { cls: "bg-yellow-50 text-yellow-700" },
};

const SOURCE_BADGE: Record<string, { cls: string }> = {
  admin: { cls: "bg-petroleum-100 text-petroleum-700" },
  staff: { cls: "bg-blue-100 text-blue-700" },
  partner: { cls: "bg-yellow-100 text-yellow-700" },
  client: { cls: "bg-green-50 text-green-700" },
  anonymous: { cls: "bg-sand-100 text-petroleum-500" },
};

const STATUS_CLS: Record<string, string> = {
  completed: "bg-green-50 text-green-700",
  paid: "bg-green-50 text-green-700",
  confirmed: "bg-green-50 text-green-700",
  active: "bg-green-50 text-green-700",
  pending: "bg-yellow-50 text-yellow-700",
  failed: "bg-red-50 text-red-600",
  cancelled: "bg-red-50 text-red-600",
  expired: "bg-red-50 text-red-600",
  refunded: "bg-yellow-50 text-yellow-700",
};

const PAGE_SIZE = 10;

// ─── Filter ───────────────────────────────────────────────────

const fieldCls =
  "border-sand-200 text-petroleum-500 placeholder:text-petroleum-300 w-full rounded-xl border bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-petroleum-300";

type TxFilter = {
  type: string;
  status: string;
  reservedBy: string;
  dateFrom: string;
  dateTo: string;
};
const emptyTxFilter: TxFilter = {
  type: "",
  status: "",
  reservedBy: "",
  dateFrom: "",
  dateTo: "",
};

// ─── Date range picker ────────────────────────────────────────

const DATE_PRESETS = [
  { key: "last7", days: 7 },
  { key: "last30", days: 30 },
  { key: "last90", days: 90 },
  { key: "thisYear", days: -1 },
] as const;

function presetDates(days: number): [string, string] {
  const today = new Date().toISOString().split("T")[0]!;
  if (days === -1) {
    const d = new Date();
    d.setMonth(0, 1);
    return [d.toISOString().split("T")[0]!, today];
  }
  const d = new Date();
  d.setDate(d.getDate() - days);
  return [d.toISOString().split("T")[0]!, today];
}

type Translator = ReturnType<typeof useTranslations<"dashboard">>;

function dateRangeLabel(
  from: string,
  to: string,
  t: Translator,
  locale: string,
): string {
  if (!from && !to) return t("common.dates.all");
  const today = new Date().toISOString().split("T")[0]!;
  for (const { key, days } of DATE_PRESETS) {
    const [f] = presetDates(days);
    if (from === f && to === today) return t(`common.dates.${key}`);
  }
  const fmt = (s: string) =>
    dateFormatter(locale, { day: "2-digit", month: "short" }).format(
      new Date(s),
    );
  if (from && to)
    return t("common.dates.range", { from: fmt(from), to: fmt(to) });
  if (from) return t("common.dates.fromOnly", { date: fmt(from) });
  return t("common.dates.untilOnly", { date: fmt(to) });
}

function DateRangeButton({
  dateFrom,
  dateTo,
  onChange,
}: {
  dateFrom: string;
  dateTo: string;
  onChange: (from: string, to: string) => void;
}) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [localFrom, setLocalFrom] = useState("");
  const [localTo, setLocalTo] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  function handleOpen() {
    setLocalFrom(dateFrom);
    setLocalTo(dateTo);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isActive = !!(dateFrom || dateTo);

  return (
    <div className="relative" ref={ref}>
      <Button
        variant={isActive ? "soft" : "outline"}
        size="md"
        onClick={() => (open ? setOpen(false) : handleOpen())}
        className="gap-2"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        {dateRangeLabel(dateFrom, dateTo, t, locale)}
      </Button>

      {open && (
        <div className="border-sand-200 absolute top-full right-0 z-50 mt-2 w-72 rounded-2xl border bg-white p-4 shadow-xl">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {DATE_PRESETS.map(({ key, days }) => {
              const [f, until] = presetDates(days);
              const active = dateFrom === f && dateTo === until;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    onChange(f, until);
                    setOpen(false);
                  }}
                  className={[
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    active
                      ? "bg-petroleum-700 text-white"
                      : "border-sand-200 text-petroleum-500 hover:border-petroleum-300 border",
                  ].join(" ")}
                >
                  {t(`common.dates.${key}`)}
                </button>
              );
            })}
          </div>
          <div className="border-sand-100 mb-3 border-t" />
          <div className="mb-3 grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-petroleum-300 text-xs">
                {t("common.dates.from")}
              </span>
              <input
                type="date"
                value={localFrom}
                onChange={(e) => setLocalFrom(e.target.value)}
                className={fieldCls}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-petroleum-300 text-xs">
                {t("common.dates.to")}
              </span>
              <input
                type="date"
                value={localTo}
                onChange={(e) => setLocalTo(e.target.value)}
                className={fieldCls}
              />
            </label>
          </div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                onChange("", "");
                setOpen(false);
              }}
              className="text-petroleum-400 hover:text-petroleum-700 text-sm transition-colors"
            >
              {t("common.dates.clear")}
            </button>
            <Button
              variant="solid"
              size="md"
              onClick={() => {
                onChange(localFrom, localTo);
                setOpen(false);
              }}
            >
              {t("common.dates.apply")}
            </Button>
          </div>
        </div>
      )}
    </div>
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
              {t("transactions.filters.type")}
            </span>
            <select
              value={pending.type}
              onChange={(e) => onChange("type", e.target.value)}
              className={fieldCls}
            >
              <option value="">{t("transactions.filters.allTypes")}</option>
              <option value="booking">{t("transactions.types.booking")}</option>
              <option value="membership">
                {t("transactions.types.membership")}
              </option>
              <option value="race">{t("transactions.types.race")}</option>
              <option value="education">
                {t("transactions.types.education")}
              </option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-petroleum-400 text-xs font-medium">
              {t("transactions.filters.status")}
            </span>
            <select
              value={pending.status}
              onChange={(e) => onChange("status", e.target.value)}
              className={fieldCls}
            >
              <option value="">{t("transactions.filters.allStatuses")}</option>
              <option value="completed">
                {t("transactions.status.completed")}
              </option>
              <option value="active">{t("transactions.status.active")}</option>
              <option value="pending">
                {t("transactions.status.pending")}
              </option>
              <option value="cancelled">
                {t("transactions.status.cancelled")}
              </option>
              <option value="expired">
                {t("transactions.status.expired")}
              </option>
              <option value="failed">{t("transactions.status.failed")}</option>
              <option value="refunded">
                {t("transactions.status.refunded")}
              </option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-petroleum-400 text-xs font-medium">
              {t("transactions.filters.reservedBy")}
            </span>
            <select
              value={pending.reservedBy}
              onChange={(e) => onChange("reservedBy", e.target.value)}
              className={fieldCls}
            >
              <option value="">{t("transactions.filters.allSources")}</option>
              <option value="admin">{t("transactions.sources.admin")}</option>
              <option value="staff">{t("transactions.sources.staff")}</option>
              <option value="partner">
                {t("transactions.sources.partner")}
              </option>
              <option value="client">{t("transactions.sources.client")}</option>
              <option value="anonymous">
                {t("transactions.sources.anonymous")}
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

function formatDate(value: string | null, locale: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(d);
}

function formatTime(value: string | null, locale: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatAmount(value: number | null, locale: string): string {
  if (value === null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function StatusBadge({ status }: { status: string | null }) {
  const t = useTranslations("dashboard.transactions");
  const s = status ?? "unknown";
  const cls = STATUS_CLS[s] ?? "bg-sand-100 text-petroleum-500";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${cls}`}
    >
      {t.has(`status.${s}`) ? t(`status.${s}`) : s}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function TransactionsPage() {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  // Resolved outside the effect so the dependency is a plain string rather
  // than the translator, which is not guaranteed to be referentially stable.
  const membershipLabel = t("transactions.types.membership");
  const [rows, setRows] = useState<UnifiedRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [appliedFilter, setAppliedFilter] = useState<TxFilter>(emptyTxFilter);
  const [pendingFilter, setPendingFilter] = useState<TxFilter>(emptyTxFilter);
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(0);
  const activeFilterCount =
    (appliedFilter.type ? 1 : 0) +
    (appliedFilter.status ? 1 : 0) +
    (appliedFilter.reservedBy ? 1 : 0);

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
    let cancelled = false;

    async function load() {
      const [bookingsRes, membersRes, racesRes, educationRes] =
        await Promise.all([
          insforge.database
            .from("bookings")
            .select(
              "id, service_title, duration, first_name, last_name, email, created_by_role, date, status, payment_status, price_eur, created_at",
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

      if (cancelled) return;

      const unified: UnifiedRow[] = [];

      for (const r of (bookingsRes.data as BookingRow[] | null) ?? []) {
        unified.push({
          id: r.id,
          type: "booking",
          title: r.service_title ?? "—",
          subtitle: r.duration ?? null,
          client: [r.first_name, r.last_name].filter(Boolean).join(" ") || "—",
          clientEmail: r.email ?? null,
          reservedBy: r.created_by_role ?? null,
          date: r.date,
          amount: r.price_eur,
          status:
            r.payment_status === "paid" ||
            (r.status === "confirmed" &&
              r.payment_status !== "failed" &&
              r.payment_status !== "refunded")
              ? "completed"
              : (r.payment_status ?? r.status),
          created_at: r.created_at,
        });
      }

      for (const r of (membersRes.data as MembershipRow[] | null) ?? []) {
        unified.push({
          id: r.id,
          type: "membership",
          title: membershipLabel,
          subtitle: null,
          client: fullName(r.contacts, r.contact_id),
          clientEmail: null,
          reservedBy: null,
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
          subtitle: null,
          client: fullName(r.contacts, r.contact_id),
          clientEmail: null,
          reservedBy: null,
          date: r.created_at,
          amount: null,
          status: "confirmed",
          created_at: r.created_at,
        });
      }

      for (const r of (educationRes.data as
        EducationRegistrationRow[] | null) ?? []) {
        unified.push({
          id: r.id,
          type: "education",
          title:
            r.education_sessions?.title ??
            (r.session_id ? `${r.session_id.slice(0, 8)}…` : "—"),
          subtitle: null,
          client: fullName(r.contacts, r.contact_id),
          clientEmail: null,
          reservedBy: null,
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

    return () => {
      cancelled = true;
    };
  }, [membershipLabel]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (appliedFilter.type && r.type !== appliedFilter.type) return false;
      if (appliedFilter.status && r.status !== appliedFilter.status)
        return false;
      if (appliedFilter.reservedBy) {
        const role = r.reservedBy ?? "anonymous";
        if (role !== appliedFilter.reservedBy) return false;
      }
      if (appliedFilter.dateFrom && r.created_at) {
        if (r.created_at.slice(0, 10) < appliedFilter.dateFrom) return false;
      }
      if (appliedFilter.dateTo && r.created_at) {
        if (r.created_at.slice(0, 10) > appliedFilter.dateTo) return false;
      }
      return true;
    });
  }, [rows, appliedFilter]);

  const stats = useMemo(() => {
    const completed = filteredRows.filter(
      (r) => r.status === "completed",
    ).length;
    const pending = filteredRows.filter((r) => r.status === "pending").length;
    const revenue = filteredRows
      .filter((r) => r.status === "completed" && r.amount !== null)
      .reduce((sum, r) => sum + (r.amount ?? 0), 0);
    return { completed, pending, revenue, total: filteredRows.length };
  }, [filteredRows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pageRows = filteredRows.slice(
    page * PAGE_SIZE,
    page * PAGE_SIZE + PAGE_SIZE,
  );

  return (
    <div className="px-6 py-8 lg:px-10">
      {/* Header */}
      <div className="mb-6 flex items-center justify-end gap-2">
        <DateRangeButton
          dateFrom={appliedFilter.dateFrom}
          dateTo={appliedFilter.dateTo}
          onChange={(from, to) => {
            setAppliedFilter((p) => ({ ...p, dateFrom: from, dateTo: to }));
            setPage(0);
          }}
        />
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

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="border-sand-200 rounded-2xl border bg-white p-6">
          <p className="text-petroleum-400 text-sm">
            {t("transactions.stats.revenue")}
          </p>
          {loading ? (
            <div className="bg-sand-100 mt-2 h-8 w-24 animate-pulse rounded-lg" />
          ) : (
            <p className="font-display text-petroleum-700 mt-1 text-3xl">
              {numberFormatter(locale, {
                style: "currency",
                currency: "EUR",
                maximumFractionDigits: 0,
              }).format(stats.revenue)}
            </p>
          )}
        </div>
        <StatCard
          label={t("transactions.stats.completed")}
          value={stats.completed}
          loading={loading}
        />
        <StatCard
          label={t("transactions.stats.pending")}
          value={stats.pending}
          loading={loading}
        />
        <StatCard
          label={t("transactions.stats.total")}
          value={stats.total}
          loading={loading}
        />
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
            {t("transactions.empty")}
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
                      {t(`transactions.types.${row.type}`)}
                    </span>
                    <StatusBadge status={row.status} />
                  </div>
                  <p className="text-petroleum-700 mt-1.5 leading-snug font-medium">
                    {row.title}
                  </p>
                  {row.subtitle && (
                    <p className="text-petroleum-400 mt-0.5 text-xs">
                      {row.subtitle}
                    </p>
                  )}
                  <p className="text-petroleum-500 mt-0.5 text-sm">
                    {row.client}
                  </p>
                  {row.clientEmail && (
                    <p className="text-petroleum-400 text-xs">
                      {row.clientEmail}
                    </p>
                  )}
                  {row.reservedBy &&
                    (() => {
                      const src =
                        SOURCE_BADGE[row.reservedBy] ??
                        SOURCE_BADGE["anonymous"];
                      return (
                        <span
                          className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${src.cls}`}
                        >
                          {t(`transactions.sources.${row.reservedBy}`)}
                        </span>
                      );
                    })()}
                  <div className="mt-1.5 flex items-center gap-3">
                    {row.created_at && (
                      <span className="text-petroleum-300 text-xs">
                        {formatDate(row.created_at, locale)}
                        {formatTime(row.created_at, locale)
                          ? ` · ${formatTime(row.created_at, locale)}`
                          : ""}
                      </span>
                    )}
                    {row.amount !== null && (
                      <span className="text-petroleum-700 text-xs font-medium">
                        {formatAmount(row.amount, locale)}
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
                    {t("transactions.columns.created")}
                  </th>
                  <th className="text-petroleum-400 px-5 py-3.5 text-xs font-medium">
                    {t("transactions.columns.status")}
                  </th>
                  <th className="text-petroleum-400 px-5 py-3.5 text-xs font-medium">
                    {t("transactions.columns.service")}
                  </th>
                  <th className="text-petroleum-400 px-5 py-3.5 text-xs font-medium">
                    {t("transactions.columns.client")}
                  </th>
                  <th className="text-petroleum-400 px-5 py-3.5 text-xs font-medium">
                    {t("transactions.columns.reservedBy")}
                  </th>
                  <th className="text-petroleum-400 px-5 py-3.5 text-right text-xs font-medium">
                    {t("transactions.columns.amount")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-sand-50 border-b">
                      {/* Created */}
                      <td className="px-5 py-4">
                        <div className="bg-sand-100 h-4 w-20 animate-pulse rounded" />
                        <div className="bg-sand-100 mt-1.5 h-3 w-12 animate-pulse rounded" />
                      </td>
                      {/* Status */}
                      <td className="px-5 py-4">
                        <div className="bg-sand-100 h-5 w-20 animate-pulse rounded-full" />
                      </td>
                      {/* Service */}
                      <td className="px-5 py-4">
                        <div className="bg-sand-100 h-4 w-40 animate-pulse rounded" />
                        <div className="bg-sand-100 mt-1.5 h-3 w-24 animate-pulse rounded" />
                      </td>
                      {/* Client */}
                      <td className="px-5 py-4">
                        <div className="bg-sand-100 h-4 w-32 animate-pulse rounded" />
                        <div className="bg-sand-100 mt-1.5 h-3 w-40 animate-pulse rounded" />
                      </td>
                      {/* Reserved by */}
                      <td className="px-5 py-4">
                        <div className="bg-sand-100 h-5 w-16 animate-pulse rounded-full" />
                      </td>
                      {/* Amount (right-aligned) */}
                      <td className="px-5 py-4 text-right">
                        <div className="bg-sand-100 ml-auto h-4 w-16 animate-pulse rounded" />
                      </td>
                    </tr>
                  ))
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-petroleum-400 px-6 py-12 text-center"
                    >
                      {t("transactions.empty")}
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
                        <td className="px-5 py-4">
                          <p className="text-petroleum-500">
                            {formatDate(row.created_at, locale)}
                          </p>
                          <p className="text-petroleum-400 text-xs">
                            {formatTime(row.created_at, locale)}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-petroleum-700 leading-snug font-medium">
                            {row.title}
                          </p>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tb.cls}`}
                            >
                              {t(`transactions.types.${row.type}`)}
                            </span>
                            {row.subtitle && (
                              <span className="text-petroleum-400 text-xs">
                                · {row.subtitle}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-petroleum-500">{row.client}</p>
                          {row.clientEmail && (
                            <p className="text-petroleum-400 mt-0.5 text-xs">
                              {row.clientEmail}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {(() => {
                            const src =
                              SOURCE_BADGE[row.reservedBy ?? "anonymous"] ??
                              SOURCE_BADGE["anonymous"];
                            return row.reservedBy !== null ? (
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${src.cls}`}
                              >
                                {t(`transactions.sources.${row.reservedBy}`)}
                              </span>
                            ) : (
                              <span className="text-petroleum-300">—</span>
                            );
                          })()}
                        </td>
                        <td className="text-petroleum-700 px-5 py-4 text-right font-medium">
                          {formatAmount(row.amount, locale)}
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

      {totalPages > 1 && (
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
