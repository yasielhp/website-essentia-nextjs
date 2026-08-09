"use client";

import { useEffect, useReducer, useCallback, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { insforge } from "@/lib/insforge";
import { useAuth } from "@/components/auth-provider";
import { useRole } from "@/context/role-context";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/dashboard/pagination";
import { StatCard } from "@/components/dashboard/calendar/stat-card";
import {
  LocationBadge,
  SOURCE_BADGE,
  StatusBadge,
  formatBookingDate,
  formatCreatedDate,
  formatCreatedTime,
} from "@/components/dashboard/booking-cells";
import { IconPlus, IconFilter } from "@/components/ui/icons";

type Booking = {
  id: string;
  service_title: string | null;
  duration: string | null;
  tier_id: string | null;
  service_tiers: { label: string | null } | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  date: string | null;
  time: string | null;
  status: string | null;
  location: string | null;
  location_address: string | null;
  created_at: string | null;
  created_by_role: string | null;
  created_by_user_id: string | null;
};

type Filters = {
  status: string;
  location: string;
  reservedBy: string;
  dateFrom: string;
  dateTo: string;
};

const emptyFilters: Filters = {
  status: "",
  location: "",
  reservedBy: "",
  dateFrom: "",
  dateTo: "",
};

const PAGE_SIZE = 10;

// ─── Helpers ──────────────────────────────────────────────────

// ─── Badges ───────────────────────────────────────────────────

const fieldCls =
  "border-sand-200 text-petroleum-500 placeholder:text-petroleum-300 w-full rounded-xl border bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-petroleum-300";

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
    new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "short",
    }).format(new Date(s));
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

// ─── Filter modal ─────────────────────────────────────────────

function FilterModal({
  pending,
  onChange,
  onApply,
  onClear,
  onClose,
}: {
  pending: Filters;
  onChange: (key: keyof Filters, value: string) => void;
  onApply: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("dashboard");
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-sm flex-col gap-5 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        {/* Header */}
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

        {/* Fields */}
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-petroleum-400 text-xs font-medium">
              {t("bookings.filters.status")}
            </span>
            <select
              value={pending.status}
              onChange={(e) => onChange("status", e.target.value)}
              className={fieldCls}
            >
              <option value="">{t("bookings.filters.allStatuses")}</option>
              {/* Ordered by lifecycle: a draft is an unfinished booking, which
                  is what marks its client as a lead. */}
              <option value="draft">{t("bookings.status.draft")}</option>
              <option value="pending">{t("bookings.status.pending")}</option>
              <option value="confirmed">
                {t("bookings.status.confirmed")}
              </option>
              <option value="cancelled">
                {t("bookings.status.cancelled")}
              </option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-petroleum-400 text-xs font-medium">
              {t("bookings.filters.location")}
            </span>
            <select
              value={pending.location}
              onChange={(e) => onChange("location", e.target.value)}
              className={fieldCls}
            >
              <option value="">{t("bookings.filters.allLocations")}</option>
              <option value="centro">{t("bookings.locations.centro")}</option>
              <option value="habitacion">
                {t("bookings.locations.habitacion")}
              </option>
              <option value="domicilio">
                {t("bookings.locations.domicilio")}
              </option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-petroleum-400 text-xs font-medium">
              {t("bookings.filters.reservedBy")}
            </span>
            <select
              value={pending.reservedBy}
              onChange={(e) => onChange("reservedBy", e.target.value)}
              className={fieldCls}
            >
              <option value="">{t("bookings.filters.allSources")}</option>
              <option value="admin">{t("bookings.sources.admin")}</option>
              <option value="staff">{t("bookings.sources.staff")}</option>
              <option value="partner">{t("bookings.sources.partner")}</option>
              <option value="client">{t("bookings.sources.client")}</option>
              <option value="anonymous">
                {t("bookings.sources.anonymous")}
              </option>
            </select>
          </label>
        </div>

        {/* Actions */}
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
  bookings: Booking[];
  total: number;
  page: number;
  loading: boolean;
};

type PageAction =
  | { type: "LOAD_SUCCESS"; bookings: Booking[]; total: number }
  | { type: "SET_LOADING" }
  | { type: "SET_PAGE"; value: number }
  | { type: "RESET_PAGE" };

const initialState: PageState = {
  bookings: [],
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
        bookings: action.bookings,
        total: action.total,
      };
    case "SET_PAGE":
      return { ...state, page: action.value };
    case "RESET_PAGE":
      return { ...state, page: 0 };
  }
}

// ─── Page ─────────────────────────────────────────────────────

const COL_COUNT = 7;

/** Falls back to the website-booking badge for a role we have no styling for. */
function sourceKey(role: string | null): string {
  return role && SOURCE_BADGE[role] ? role : "anonymous";
}

export default function BookingsPage() {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const [state, dispatch] = useReducer(reducer, initialState);
  const { bookings, total, page, loading } = state;
  const { push } = useRouter();
  const { user } = useAuth();
  const { role } = useRole();

  const isPartner = role === "partner";
  const isStaff = role === "staff";
  const userId = user?.id ?? null;

  // Service IDs assigned to this staff user (null = not yet loaded)
  const [staffServiceIds, setStaffServiceIds] = useState<string[] | null>(
    isStaff ? null : [],
  );

  useEffect(() => {
    if (!isStaff || !userId) return;
    void insforge.database
      .from("staff_services")
      .select("service_id")
      .eq("staff_id", userId)
      .then(({ data }) => {
        setStaffServiceIds(
          ((data ?? []) as { service_id: string }[]).map((r) => r.service_id),
        );
      });
  }, [isStaff, userId]);

  const [appliedFilters, setAppliedFilters] = useState<Filters>(emptyFilters);
  const [pendingFilters, setPendingFilters] = useState<Filters>(emptyFilters);
  const [filterOpen, setFilterOpen] = useState(false);

  const activeCount =
    (appliedFilters.status ? 1 : 0) +
    (appliedFilters.location ? 1 : 0) +
    (appliedFilters.reservedBy ? 1 : 0);

  function openModal() {
    setPendingFilters(appliedFilters);
    setFilterOpen(true);
  }

  function applyFilters() {
    setAppliedFilters(pendingFilters);
    dispatch({ type: "RESET_PAGE" });
    setFilterOpen(false);
  }

  function clearFilters() {
    setAppliedFilters(emptyFilters);
    setPendingFilters(emptyFilters);
    dispatch({ type: "RESET_PAGE" });
    setFilterOpen(false);
  }

  const {
    status: fStatus,
    location: fLocation,
    reservedBy: fReservedBy,
    dateFrom: fDateFrom,
    dateTo: fDateTo,
  } = appliedFilters;

  const [statusCounts, setStatusCounts] = useState<{
    draft: number | null;
    pending: number | null;
    confirmed: number | null;
    cancelled: number | null;
  }>({ draft: null, pending: null, confirmed: null, cancelled: null });

  // The cards are a breakdown by status of whatever the filters currently
  // select, so they apply every filter except the status one — applying that
  // would zero three of the four. Only "Total Bookings" used to follow the
  // list query, which applies all of them, so with a location or reserved-by
  // filter on, the four stopped adding up to the total beside them.
  useEffect(() => {
    // Wait until we know the staff's service list
    if (isStaff && staffServiceIds === null) return;
    if (isPartner && !userId) return;

    const makeQuery = (status: string) => {
      let q = insforge.database
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("status", status);
      if (isPartner) q = q.eq("partner_id", userId!);
      if (isStaff && staffServiceIds && staffServiceIds.length > 0)
        q = q.in("service_id", staffServiceIds);
      if (isStaff && staffServiceIds?.length === 0)
        return Promise.resolve({ count: 0 });
      if (fLocation) q = q.eq("location", fLocation);
      if (fReservedBy) q = q.eq("created_by_role", fReservedBy);
      if (fDateFrom) q = q.gte("date", fDateFrom);
      if (fDateTo) q = q.lte("date", fDateTo);
      return q;
    };

    void Promise.all([
      makeQuery("draft"),
      makeQuery("pending"),
      makeQuery("confirmed"),
      makeQuery("cancelled"),
    ]).then(([d, p, c, x]) =>
      setStatusCounts({
        draft: (d as { count: number | null }).count ?? 0,
        pending: (p as { count: number | null }).count ?? 0,
        confirmed: (c as { count: number | null }).count ?? 0,
        cancelled: (x as { count: number | null }).count ?? 0,
      }),
    );
  }, [
    isPartner,
    isStaff,
    userId,
    staffServiceIds,
    fLocation,
    fReservedBy,
    fDateFrom,
    fDateTo,
  ]);

  // Every card in the row is drawn from the same four figures, so the total is
  // their sum rather than a fifth query that could disagree with them.
  const countsTotal =
    statusCounts.draft === null ||
    statusCounts.pending === null ||
    statusCounts.confirmed === null ||
    statusCounts.cancelled === null
      ? null
      : statusCounts.draft +
        statusCounts.pending +
        statusCounts.confirmed +
        statusCounts.cancelled;

  const fetchBookings = useCallback(async () => {
    // Wait until staff service IDs are loaded
    if (isStaff && staffServiceIds === null) return;
    if (isPartner && !userId) return;

    // Staff with no assigned services → empty result
    if (isStaff && staffServiceIds?.length === 0) {
      dispatch({ type: "LOAD_SUCCESS", bookings: [], total: 0 });
      return;
    }

    dispatch({ type: "SET_LOADING" });

    let query = insforge.database
      .from("bookings")
      .select(
        "id, service_title, duration, tier_id, service_tiers(label), first_name, last_name, email, phone, date, time, status, location, location_address, created_at, created_by_role, created_by_user_id",
        { count: "exact" },
      );

    if (isPartner) query = query.eq("partner_id", userId!);
    if (isStaff && staffServiceIds && staffServiceIds.length > 0)
      query = query.in("service_id", staffServiceIds);

    if (fStatus) query = query.eq("status", fStatus);
    if (fLocation) query = query.eq("location", fLocation);
    if (fReservedBy) query = query.eq("created_by_role", fReservedBy);
    if (fDateFrom) query = query.gte("date", fDateFrom);
    if (fDateTo) query = query.lte("date", fDateTo);

    const { data, count } = await query
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    const rows: Booking[] = (data as Booking[] | null) ?? [];

    dispatch({
      type: "LOAD_SUCCESS",
      bookings: rows,
      total: count ?? 0,
    });
  }, [
    page,
    fStatus,
    fLocation,
    fReservedBy,
    fDateFrom,
    fDateTo,
    isPartner,
    isStaff,
    userId,
    staffServiceIds,
  ]);

  useEffect(() => {
    void fetchBookings();
  }, [fetchBookings]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="px-6 py-8 lg:px-10">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <Button
          variant="solid"
          size="md"
          href="/dashboard/bookings/new"
          className="gap-2"
        >
          <IconPlus />
          {t("bookings.createBooking")}
        </Button>
        <div className="flex items-center gap-2">
          <DateRangeButton
            dateFrom={appliedFilters.dateFrom}
            dateTo={appliedFilters.dateTo}
            onChange={(from, to) => {
              setAppliedFilters((p) => ({ ...p, dateFrom: from, dateTo: to }));
              dispatch({ type: "RESET_PAGE" });
            }}
          />
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
      </div>

      {/* Stats */}
      {/* Ordered by lifecycle, matching the status filter. */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          label={t("bookings.stats.draft")}
          value={statusCounts.draft ?? 0}
          loading={statusCounts.draft === null}
          active={fStatus === "draft"}
        />
        <StatCard
          label={t("bookings.stats.pending")}
          value={statusCounts.pending ?? 0}
          loading={statusCounts.pending === null}
          active={fStatus === "pending"}
        />
        <StatCard
          label={t("bookings.stats.confirmed")}
          value={statusCounts.confirmed ?? 0}
          loading={statusCounts.confirmed === null}
          active={fStatus === "confirmed"}
        />
        <StatCard
          label={t("bookings.stats.cancelled")}
          value={statusCounts.cancelled ?? 0}
          loading={statusCounts.cancelled === null}
          active={fStatus === "cancelled"}
        />
        <StatCard
          label={t("bookings.stats.total")}
          value={countsTotal ?? 0}
          loading={countsTotal === null}
        />
      </div>

      {/* Mobile cards */}
      <div className="border-sand-200 divide-sand-200 mb-4 divide-y rounded-2xl border bg-white sm:hidden">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-5 py-4">
              {/* Row 1: name + status badge */}
              <div className="flex items-center justify-between gap-2">
                <div className="bg-sand-100 h-4 w-32 animate-pulse rounded" />
                <div className="bg-sand-100 h-5 w-20 animate-pulse rounded-full" />
              </div>
              {/* Row 2: service */}
              <div className="bg-sand-100 mt-2 h-3 w-40 animate-pulse rounded" />
              {/* Row 3: date + location badge */}
              <div className="mt-1.5 flex items-center gap-2">
                <div className="bg-sand-100 h-3 w-24 animate-pulse rounded" />
                <div className="bg-sand-100 h-4 w-16 animate-pulse rounded-full" />
              </div>
            </div>
          ))
        ) : bookings.length === 0 ? (
          <p className="text-petroleum-400 px-6 py-12 text-center text-sm">
            {t("bookings.empty")}
          </p>
        ) : (
          bookings.map((b) => {
            const fullName =
              [b.first_name, b.last_name].filter(Boolean).join(" ") || "—";
            return (
              <div
                key={b.id}
                onClick={() => push(`/dashboard/bookings/${b.id}`)}
                className="hover:bg-sand-50 cursor-pointer px-5 py-4 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-petroleum-700 truncate font-medium">
                      {fullName}
                    </p>
                    {b.email && (
                      <p className="text-petroleum-400 truncate text-xs">
                        {b.email}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={b.status} />
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <p className="text-petroleum-500 text-sm">
                    {b.service_title ?? "—"}
                  </p>
                  {(b.service_tiers?.label || b.duration) && (
                    <span className="text-petroleum-400 text-xs">
                      ·{" "}
                      {[b.service_tiers?.label, b.duration]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-3">
                  <p className="text-petroleum-400 text-xs">
                    {formatBookingDate(b.date, locale)}
                    {b.time ? ` · ${b.time}` : ""}
                  </p>
                  <div className="flex flex-col gap-0.5">
                    <LocationBadge location={b.location} />
                    {(b.location === "centro" || b.location === "habitacion") &&
                      b.location_address &&
                      (() => {
                        try {
                          const addr = JSON.parse(b.location_address) as Record<
                            string,
                            string
                          >;
                          const parts = [
                            addr.reservationNumber
                              ? `#${addr.reservationNumber}`
                              : null,
                            addr.roomNumber ? `Room ${addr.roomNumber}` : null,
                          ].filter(Boolean);
                          return parts.length > 0 ? (
                            <p className="text-petroleum-400 text-xs">
                              {parts.join(" · ")}
                            </p>
                          ) : null;
                        } catch {
                          return null;
                        }
                      })()}
                  </div>
                  {(() => {
                    const source = sourceKey(b.created_by_role);
                    return (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SOURCE_BADGE[source]!.cls}`}
                      >
                        {t(`bookings.sources.${source}`)}
                      </span>
                    );
                  })()}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Table (desktop only) */}
      <div className="border-sand-200 hidden rounded-2xl border bg-white sm:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-sand-200 border-b text-left">
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("bookings.columns.created")}
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("bookings.columns.status")}
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("bookings.columns.client")}
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("bookings.columns.service")}
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("bookings.columns.location")}
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("bookings.columns.datetime")}
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("bookings.columns.reservedBy")}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-sand-50 border-b">
                    {/* Created */}
                    <td className="px-5 py-4">
                      <div className="bg-sand-100 h-4 w-24 animate-pulse rounded" />
                      <div className="bg-sand-100 mt-1.5 h-3 w-14 animate-pulse rounded" />
                    </td>
                    {/* Status */}
                    <td className="px-5 py-4">
                      <div className="bg-sand-100 h-5 w-20 animate-pulse rounded-full" />
                    </td>
                    {/* Client */}
                    <td className="px-5 py-4">
                      <div className="bg-sand-100 h-4 w-28 animate-pulse rounded" />
                      <div className="bg-sand-100 mt-1.5 h-3 w-36 animate-pulse rounded" />
                    </td>
                    {/* Service */}
                    <td className="px-5 py-4">
                      <div className="bg-sand-100 h-4 w-32 animate-pulse rounded" />
                      <div className="bg-sand-100 mt-1.5 h-3 w-16 animate-pulse rounded" />
                    </td>
                    {/* Location */}
                    <td className="px-5 py-4">
                      <div className="bg-sand-100 h-5 w-24 animate-pulse rounded-full" />
                    </td>
                    {/* Datetime */}
                    <td className="px-5 py-4">
                      <div className="bg-sand-100 h-4 w-24 animate-pulse rounded" />
                      <div className="bg-sand-100 mt-1.5 h-3 w-12 animate-pulse rounded" />
                    </td>
                    {/* Reserved by */}
                    <td className="px-5 py-4">
                      <div className="bg-sand-100 h-5 w-16 animate-pulse rounded-full" />
                    </td>
                  </tr>
                ))
              ) : bookings.length === 0 ? (
                <tr>
                  <td
                    colSpan={COL_COUNT}
                    className="text-petroleum-400 px-6 py-12 text-center"
                  >
                    {t("bookings.empty")}
                  </td>
                </tr>
              ) : (
                bookings.map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => push(`/dashboard/bookings/${b.id}`)}
                    className="border-sand-50 hover:bg-sand-50 cursor-pointer border-b transition-colors"
                  >
                    <td className="px-5 py-4">
                      <p className="text-petroleum-500">
                        {formatCreatedDate(b.created_at, locale)}
                      </p>
                      <p className="text-petroleum-400 text-xs">
                        {formatCreatedTime(b.created_at, locale)}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-petroleum-500">
                        {[b.first_name, b.last_name]
                          .filter(Boolean)
                          .join(" ") || "—"}
                      </p>
                      {b.email && (
                        <p className="text-petroleum-400 text-xs">{b.email}</p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-petroleum-700 font-medium">
                        {b.service_title ?? "—"}
                      </p>
                      {(b.service_tiers?.label || b.duration) && (
                        <p className="text-petroleum-400 text-xs">
                          {[b.service_tiers?.label, b.duration]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <LocationBadge location={b.location} />
                      {(b.location === "centro" ||
                        b.location === "habitacion") &&
                        b.location_address &&
                        (() => {
                          try {
                            const addr = JSON.parse(
                              b.location_address,
                            ) as Record<string, string>;
                            const parts = [
                              addr.reservationNumber
                                ? `#${addr.reservationNumber}`
                                : null,
                              addr.roomNumber
                                ? `Room ${addr.roomNumber}`
                                : null,
                            ].filter(Boolean);
                            return parts.length > 0 ? (
                              <p className="text-petroleum-400 mt-1 text-xs">
                                {parts.join(" · ")}
                              </p>
                            ) : null;
                          } catch {
                            return null;
                          }
                        })()}
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-petroleum-500">
                        {formatBookingDate(b.date, locale)}
                      </p>
                      {b.time && (
                        <p className="text-petroleum-400 text-xs">{b.time}</p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {(() => {
                        const source = sourceKey(b.created_by_role);
                        return (
                          <span
                            className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${SOURCE_BADGE[source]!.cls}`}
                          >
                            {t(`bookings.sources.${source}`)}
                          </span>
                        );
                      })()}
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
          pending={pendingFilters}
          onChange={(key, value) =>
            setPendingFilters((prev) => ({ ...prev, [key]: value }))
          }
          onApply={applyFilters}
          onClear={clearFilters}
          onClose={() => setFilterOpen(false)}
        />
      )}
    </div>
  );
}
