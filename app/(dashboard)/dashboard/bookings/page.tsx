"use client";

import { useEffect, useReducer, useCallback, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { useAuth } from "@/components/auth-provider";
import { useRole } from "@/context/role-context";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/dashboard/pagination";
import { StatCard } from "@/components/dashboard/calendar/stat-card";

type Booking = {
  id: string;
  service_title: string | null;
  duration: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  date: string | null;
  time: string | null;
  status: string | null;
  location: string | null;
  created_at: string | null;
  created_by_role: string | null;
  created_by_user_id: string | null;
  creatorName?: string | null;
};

type Filters = {
  status: string;
  location: string;
  service: string;
  client: string;
  date: string;
};

const emptyFilters: Filters = {
  status: "",
  location: "",
  service: "",
  client: "",
  date: "",
};

const PAGE_SIZE = 10;

// ─── Helpers ──────────────────────────────────────────────────

function formatBookingDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const parts = dateStr.split("-").map(Number);
  if (parts.length < 3) return dateStr;
  const [y, m, d] = parts as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatCreatedDate(isoStr: string | null): string {
  if (!isoStr) return "—";
  return new Date(isoStr).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatCreatedTime(isoStr: string | null): string {
  if (!isoStr) return "";
  return new Date(isoStr).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Badges ───────────────────────────────────────────────────

const statusBadgeClasses: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-600",
};

function StatusBadge({ status }: { status: string | null }) {
  const s = status ?? "unknown";
  const cls = statusBadgeClasses[s] ?? "bg-sand-100 text-petroleum-500";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${cls}`}
    >
      {s}
    </span>
  );
}

const locationLabels: Record<string, string> = {
  centro: "At the center",
  habitacion: "Room",
  domicilio: "Home visit",
};

const locationBadgeClasses: Record<string, string> = {
  centro: "bg-blue-50 text-blue-700",
  habitacion: "bg-purple-50 text-purple-700",
  domicilio: "bg-teal-50 text-teal-700",
};

function LocationBadge({ location }: { location: string | null }) {
  if (!location) return <span className="text-petroleum-300">—</span>;
  const label = locationLabels[location] ?? location;
  const cls =
    locationBadgeClasses[location] ?? "bg-sand-100 text-petroleum-500";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}
    >
      {label}
    </span>
  );
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

// ─── Autocomplete input ────────────────────────────────────────

const fieldCls =
  "border-sand-200 text-petroleum-500 placeholder:text-petroleum-300 w-full rounded-xl border bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-petroleum-300";

function AutocompleteInput({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  const visible = options.filter(
    (o) =>
      o.toLowerCase().includes(value.toLowerCase()) &&
      o.toLowerCase() !== value.toLowerCase(),
  );

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        autoComplete="off"
        className={fieldCls}
      />
      {open && visible.length > 0 && (
        <div className="border-sand-200 absolute top-full right-0 left-0 z-20 mt-1 max-h-48 overflow-auto rounded-xl border bg-white shadow-md">
          {visible.map((opt) => (
            <button
              key={opt}
              type="button"
              onMouseDown={() => {
                onChange(opt);
                setOpen(false);
              }}
              className="text-petroleum-700 hover:bg-sand-50 w-full px-3 py-2 text-left text-sm"
            >
              {opt}
            </button>
          ))}
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
  const [serviceOptions, setServiceOptions] = useState<string[]>([]);
  const [clientOptions, setClientOptions] = useState<string[]>([]);
  const clientDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load services once on mount
  useEffect(() => {
    void insforge.database
      .from("service_settings")
      .select("title")
      .eq("active", true)
      .order("title")
      .then(({ data }) => {
        setServiceOptions(
          ((data ?? []) as { title: string }[])
            .map((s) => s.title)
            .filter(Boolean),
        );
      });
  }, []);

  // Live client search with debounce
  useEffect(() => {
    if (clientDebounce.current) clearTimeout(clientDebounce.current);
    if (!pending.client) {
      clientDebounce.current = setTimeout(() => setClientOptions([]), 0);
      return;
    }

    clientDebounce.current = setTimeout(async () => {
      const term = pending.client;
      const { data } = await insforge.database
        .from("bookings")
        .select("first_name, last_name")
        .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%`)
        .limit(30);

      const seen = new Set<string>();
      const names: string[] = [];
      for (const b of (data ?? []) as {
        first_name: string | null;
        last_name: string | null;
      }[]) {
        const name = [b.first_name, b.last_name].filter(Boolean).join(" ");
        if (name && !seen.has(name)) {
          seen.add(name);
          names.push(name);
        }
      }
      setClientOptions(names);
    }, 300);
  }, [pending.client]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-sm flex-col gap-5 rounded-2xl bg-white p-6 shadow-xl">
        {/* Header */}
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

        {/* Fields */}
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
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-petroleum-400 text-xs font-medium">
              Location
            </span>
            <select
              value={pending.location}
              onChange={(e) => onChange("location", e.target.value)}
              className={fieldCls}
            >
              <option value="">All locations</option>
              <option value="centro">At the center</option>
              <option value="habitacion">Room</option>
              <option value="domicilio">Home visit</option>
            </select>
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-petroleum-400 text-xs font-medium">
              Service
            </span>
            <AutocompleteInput
              value={pending.service}
              onChange={(v) => onChange("service", v)}
              options={serviceOptions}
              placeholder="Search service…"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-petroleum-400 text-xs font-medium">
              Client
            </span>
            <AutocompleteInput
              value={pending.client}
              onChange={(v) => onChange("client", v)}
              options={clientOptions}
              placeholder="Search client…"
            />
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-petroleum-400 text-xs font-medium">Date</span>
            <input
              type="date"
              value={pending.date}
              onChange={(e) => onChange("date", e.target.value)}
              className={fieldCls}
            />
          </label>
        </div>

        {/* Actions */}
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

const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  admin: { label: "Admin", cls: "bg-petroleum-100 text-petroleum-700" },
  staff: { label: "Staff", cls: "bg-blue-100 text-blue-700" },
  partner: { label: "Partner", cls: "bg-yellow-100 text-yellow-700" },
  client: { label: "Client", cls: "bg-green-50 text-green-700" },
  anonymous: { label: "Web", cls: "bg-sand-100 text-petroleum-500" },
};

export default function BookingsPage() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { bookings, total, page, loading } = state;
  const { push } = useRouter();
  const { user } = useAuth();
  const { role } = useRole();

  const isPartner = role === "partner";
  const partnerId = user?.id ?? null;

  const [statusCounts, setStatusCounts] = useState<{
    pending: number | null;
    confirmed: number | null;
    cancelled: number | null;
  }>({ pending: null, confirmed: null, cancelled: null });

  useEffect(() => {
    if (isPartner && !partnerId) return;
    const base = (q: ReturnType<typeof insforge.database.from>) =>
      isPartner ? q.eq("partner_id", partnerId!) : q;

    void Promise.all([
      base(
        insforge.database
          .from("bookings")
          .select("id", { count: "exact", head: true }),
      ).eq("status", "pending"),
      base(
        insforge.database
          .from("bookings")
          .select("id", { count: "exact", head: true }),
      ).eq("status", "confirmed"),
      base(
        insforge.database
          .from("bookings")
          .select("id", { count: "exact", head: true }),
      ).eq("status", "cancelled"),
    ]).then(([p, c, x]) =>
      setStatusCounts({
        pending: (p as { count: number | null }).count ?? 0,
        confirmed: (c as { count: number | null }).count ?? 0,
        cancelled: (x as { count: number | null }).count ?? 0,
      }),
    );
  }, [isPartner, partnerId]);

  const [appliedFilters, setAppliedFilters] = useState<Filters>(emptyFilters);
  const [pendingFilters, setPendingFilters] = useState<Filters>(emptyFilters);
  const [filterOpen, setFilterOpen] = useState(false);

  const activeCount = Object.values(appliedFilters).filter(Boolean).length;

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
    service: fService,
    client: fClient,
    date: fDate,
  } = appliedFilters;

  const fetchBookings = useCallback(async () => {
    if (isPartner && !partnerId) return;
    dispatch({ type: "SET_LOADING" });

    let query = insforge.database
      .from("bookings")
      .select(
        "id, service_title, duration, first_name, last_name, email, phone, date, time, status, location, created_at, created_by_role, created_by_user_id",
        { count: "exact" },
      );

    if (isPartner) query = query.eq("partner_id", partnerId!);

    if (fStatus) query = query.eq("status", fStatus);
    if (fLocation) query = query.eq("location", fLocation);
    if (fService) query = query.ilike("service_title", `%${fService}%`);
    if (fClient) {
      const parts = fClient.trim().split(/\s+/);
      if (parts.length >= 2) {
        query = query
          .ilike("first_name", `%${parts[0]}%`)
          .ilike("last_name", `%${parts[1]}%`);
      } else {
        query = query.or(
          `first_name.ilike.%${fClient}%,last_name.ilike.%${fClient}%`,
        );
      }
    }
    if (fDate) query = query.eq("date", fDate);

    const { data, count } = await query
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    const rows: Booking[] = (data as Booking[] | null) ?? [];

    const creatorIds = [
      ...new Set(
        rows
          .map((b) => b.created_by_user_id)
          .filter((id): id is string => !!id),
      ),
    ];

    const nameMap: Record<string, string> = {};
    if (creatorIds.length > 0) {
      const { data: profiles } = await insforge.database
        .from("profiles")
        .select("id, full_name")
        .in("id", creatorIds);
      for (const p of (profiles ?? []) as {
        id: string;
        full_name: string | null;
      }[]) {
        if (p.full_name) nameMap[p.id] = p.full_name;
      }
    }

    const enriched = rows.map((b) => ({
      ...b,
      creatorName: b.created_by_user_id
        ? (nameMap[b.created_by_user_id] ?? null)
        : null,
    }));

    dispatch({
      type: "LOAD_SUCCESS",
      bookings: enriched,
      total: count ?? 0,
    });
  }, [
    page,
    fStatus,
    fLocation,
    fService,
    fClient,
    fDate,
    isPartner,
    partnerId,
  ]);

  useEffect(() => {
    void fetchBookings();
  }, [fetchBookings]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="px-6 py-8 lg:px-10">
      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Pending"
          value={statusCounts.pending ?? 0}
          loading={statusCounts.pending === null}
        />
        <StatCard
          label="Confirmed"
          value={statusCounts.confirmed ?? 0}
          loading={statusCounts.confirmed === null}
        />
        <StatCard
          label="Cancelled"
          value={statusCounts.cancelled ?? 0}
          loading={statusCounts.cancelled === null}
        />
        <StatCard
          label="Total Bookings"
          value={total}
          loading={loading && total === 0}
        />
      </div>

      {/* Header */}
      <div className="mb-8 flex items-center justify-between gap-3">
        <Button
          variant="solid"
          size="md"
          href="/dashboard/bookings/new"
          className="gap-2"
        >
          <IconPlus />
          Create Booking
        </Button>
        <Button
          variant={activeCount > 0 ? "soft" : "outline"}
          size="md"
          onClick={openModal}
          className="gap-2"
        >
          <IconFilter />
          Filters{activeCount > 0 ? ` [${activeCount}]` : ""}
        </Button>
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
            No bookings found.
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
                  {b.duration && (
                    <span className="text-petroleum-400 text-xs">
                      · {b.duration}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex items-center gap-3">
                  <p className="text-petroleum-400 text-xs">
                    {formatBookingDate(b.date)}
                    {b.time ? ` · ${b.time}` : ""}
                  </p>
                  <LocationBadge location={b.location} />
                  {(() => {
                    const src =
                      SOURCE_BADGE[b.created_by_role ?? ""] ??
                      SOURCE_BADGE["anonymous"];
                    return (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${src.cls}`}
                      >
                        {src.label}
                        {b.creatorName ? ` · ${b.creatorName}` : ""}
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
                  Created
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Status
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Client
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Service
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Location
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Datetime
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Reserved by
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
                    No bookings found.
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
                        {formatCreatedDate(b.created_at)}
                      </p>
                      <p className="text-petroleum-400 text-xs">
                        {formatCreatedTime(b.created_at)}
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
                      {b.duration && (
                        <p className="text-petroleum-400 text-xs">
                          {b.duration}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <LocationBadge location={b.location} />
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-petroleum-500">
                        {formatBookingDate(b.date)}
                      </p>
                      {b.time && (
                        <p className="text-petroleum-400 text-xs">{b.time}</p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {(() => {
                        const src =
                          SOURCE_BADGE[b.created_by_role ?? ""] ??
                          SOURCE_BADGE["anonymous"];
                        return (
                          <div className="flex flex-col gap-0.5">
                            <span
                              className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${src.cls}`}
                            >
                              {src.label}
                            </span>
                            {b.creatorName && (
                              <span className="text-petroleum-400 text-xs">
                                {b.creatorName}
                              </span>
                            )}
                          </div>
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
