"use client";

import { useEffect, useReducer, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/dashboard/pagination";
import { StatCard } from "@/components/dashboard/calendar/stat-card";

// ─── Types ────────────────────────────────────────────────────

type ContactRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  created_at: string | null;
};

type SystemRole = "admin" | "staff" | "partner";

type SystemUserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: SystemRole;
};

type DisplayRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  created_at: string | null;
  href: string;
};

// ─── Constants ────────────────────────────────────────────────

const PAGE_SIZE = 20;

const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  admin: { label: "Admin", cls: "bg-petroleum-100 text-petroleum-700" },
  staff: { label: "Staff", cls: "bg-blue-100 text-blue-700" },
  partner: { label: "Partner", cls: "bg-yellow-100 text-yellow-700" },
  lead: { label: "Lead", cls: "bg-sand-100 text-petroleum-500" },
  client: { label: "Client", cls: "bg-green-50 text-green-700" },
};

// ─── Helpers ──────────────────────────────────────────────────

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

function AvatarFallback() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      className="text-petroleum-300"
    >
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M4 20c0-4 3.6-7 8-7s8 3 8 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

const fieldCls =
  "border-sand-200 text-petroleum-500 placeholder:text-petroleum-300 w-full rounded-xl border bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-petroleum-300";

type UserFilter = { role: string };
const emptyUserFilter: UserFilter = { role: "" };

// ─── Contacts state ───────────────────────────────────────────

type ContactsState = {
  contacts: ContactRow[];
  loading: boolean;
  total: number;
  page: number;
};

type ContactsAction =
  | { type: "SET_LOADING" }
  | { type: "LOADED"; contacts: ContactRow[]; total: number }
  | { type: "SET_PAGE"; page: number };

function contactsReducer(
  state: ContactsState,
  action: ContactsAction,
): ContactsState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: true };
    case "LOADED":
      return {
        ...state,
        loading: false,
        contacts: action.contacts,
        total: action.total,
      };
    case "SET_PAGE":
      return { ...state, page: action.page };
  }
}

// ─── System users state ───────────────────────────────────────

type SystemState = { users: SystemUserRow[]; loading: boolean };
type SystemAction =
  | { type: "SET_LOADING" }
  | { type: "LOADED"; users: SystemUserRow[] };

function systemReducer(state: SystemState, action: SystemAction): SystemState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: true };
    case "LOADED":
      return { loading: false, users: action.users };
  }
}

// ─── Filter Modal ─────────────────────────────────────────────

function FilterModal({
  pending,
  onChange,
  onApply,
  onClear,
  onClose,
}: {
  pending: UserFilter;
  onChange: (key: keyof UserFilter, value: string) => void;
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
            <span className="text-petroleum-400 text-xs font-medium">Role</span>
            <select
              value={pending.role}
              onChange={(e) => onChange("role", e.target.value)}
              className={fieldCls}
            >
              <option value="">All</option>
              <option value="lead">Lead</option>
              <option value="client">Client</option>
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
              <option value="partner">Partner</option>
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

// ─── Page ─────────────────────────────────────────────────────

export default function UsersPage() {
  const { push } = useRouter();

  const [contacts, dispatchContacts] = useReducer(contactsReducer, {
    contacts: [],
    loading: true,
    total: 0,
    page: 0,
  });

  const [system, dispatchSystem] = useReducer(systemReducer, {
    users: [],
    loading: true,
  });

  const [roleCounts, setRoleCounts] = useState<{
    leads: number | null;
    clients: number | null;
    staff: number | null;
    partner: number | null;
  }>({ leads: null, clients: null, staff: null, partner: null });

  const [appliedFilter, setAppliedFilter] =
    useState<UserFilter>(emptyUserFilter);
  const [pendingFilter, setPendingFilter] =
    useState<UserFilter>(emptyUserFilter);
  const [filterOpen, setFilterOpen] = useState(false);
  const activeFilterCount = Object.values(appliedFilter).filter(Boolean).length;

  function openModal() {
    setPendingFilter(appliedFilter);
    setFilterOpen(true);
  }
  function applyFilters() {
    setAppliedFilter(pendingFilter);
    setFilterOpen(false);
  }
  function clearFilters() {
    setAppliedFilter(emptyUserFilter);
    setPendingFilter(emptyUserFilter);
    setFilterOpen(false);
  }

  // ── Load contacts ──
  const loadContacts = useCallback(async (page: number) => {
    dispatchContacts({ type: "SET_LOADING" });
    const { data, count } = await insforge.database
      .from("contacts")
      .select("id, first_name, last_name, email, phone, status, created_at", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    dispatchContacts({
      type: "LOADED",
      contacts: (data as ContactRow[] | null) ?? [],
      total: count ?? 0,
    });
  }, []);

  useEffect(() => {
    void loadContacts(contacts.page);
  }, [loadContacts, contacts.page]);

  // ── Load system users (eager) ──
  useEffect(() => {
    dispatchSystem({ type: "SET_LOADING" });
    void insforge.database
      .from("profiles")
      .select("id, full_name, email, phone, role")
      .in("role", ["admin", "staff", "partner"])
      .order("role")
      .order("full_name")
      .then(({ data }) => {
        dispatchSystem({
          type: "LOADED",
          users: (data as SystemUserRow[] | null) ?? [],
        });
      });
  }, []);

  // ── Load role counts ──
  useEffect(() => {
    void Promise.all([
      insforge.database
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .or("status.eq.lead,status.is.null"),
      insforge.database
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("status", "client"),
      insforge.database
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "staff"),
      insforge.database
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "partner"),
    ]).then(([leads, clients, staff, partner]) => {
      setRoleCounts({
        leads: (leads as { count: number | null }).count ?? 0,
        clients: (clients as { count: number | null }).count ?? 0,
        staff: (staff as { count: number | null }).count ?? 0,
        partner: (partner as { count: number | null }).count ?? 0,
      });
    });
  }, []);

  const totalPages = Math.max(1, Math.ceil(contacts.total / PAGE_SIZE));
  const isFirstPage = contacts.page === 0;
  const loading = contacts.loading || system.loading;

  // Merge: system users first (only on page 0), then contacts
  const systemRows: DisplayRow[] = system.users.map((u) => ({
    id: u.id,
    name: u.full_name ?? "—",
    email: u.email,
    phone: u.phone,
    role: u.role,
    created_at: null,
    href: `/dashboard/users/${u.id}`,
  }));

  const contactRows: DisplayRow[] = contacts.contacts.map((c) => ({
    id: c.id,
    name: [c.first_name, c.last_name].filter(Boolean).join(" ") || "—",
    email: c.email,
    phone: c.phone,
    role: c.status ?? "lead",
    created_at: c.created_at,
    href: `/dashboard/contacts/${c.id}`,
  }));

  const displayRows: DisplayRow[] = isFirstPage
    ? [...systemRows, ...contactRows]
    : contactRows;

  const filteredRows = appliedFilter.role
    ? displayRows.filter((r) => r.role === appliedFilter.role)
    : displayRows;

  return (
    <div className="px-6 py-8 lg:px-10">
      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Leads"
          value={roleCounts.leads ?? 0}
          loading={roleCounts.leads === null}
        />
        <StatCard
          label="Clients"
          value={roleCounts.clients ?? 0}
          loading={roleCounts.clients === null}
        />
        <StatCard
          label="Staff"
          value={roleCounts.staff ?? 0}
          loading={roleCounts.staff === null}
        />
        <StatCard
          label="Partners"
          value={roleCounts.partner ?? 0}
          loading={roleCounts.partner === null}
        />
      </div>

      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <Button
          variant="solid"
          size="md"
          href="/dashboard/users/new"
          className="gap-2"
        >
          <IconPlus />
          Add user
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

      {/* Mobile cards */}
      <div className="sm:hidden">
        {loading ? (
          <div className="divide-sand-200 border-sand-200 divide-y overflow-hidden rounded-2xl border bg-white">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-4">
                <div className="bg-sand-100 size-9 shrink-0 animate-pulse rounded-lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="bg-sand-100 h-4 w-28 animate-pulse rounded" />
                    <div className="bg-sand-100 h-5 w-14 animate-pulse rounded-full" />
                  </div>
                  <div className="bg-sand-100 mt-1.5 h-3 w-44 animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredRows.length === 0 ? (
          <p className="text-petroleum-400 py-12 text-center text-sm">
            No users yet.
          </p>
        ) : (
          <div className="divide-sand-200 border-sand-200 divide-y overflow-hidden rounded-2xl border bg-white">
            {filteredRows.map((row) => {
              const badge = ROLE_BADGE[row.role] ?? ROLE_BADGE.contact!;
              return (
                <div
                  key={row.id}
                  onClick={() => push(row.href)}
                  className="hover:bg-sand-50 flex cursor-pointer items-center gap-3 px-4 py-4 transition-colors"
                >
                  <div className="bg-sand-100 flex size-9 shrink-0 items-center justify-center rounded-lg">
                    <AvatarFallback />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-petroleum-700 truncate font-medium">
                        {row.name}
                      </p>
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                    {row.email && (
                      <p className="text-petroleum-400 mt-0.5 truncate text-sm">
                        {row.email}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block">
        <div className="border-sand-200 rounded-2xl border bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-sand-200 border-b text-left">
                  <th className="text-petroleum-400 w-10 px-5 py-3.5 font-medium" />
                  <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                    Name
                  </th>
                  <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                    Email
                  </th>
                  <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                    Phone
                  </th>
                  <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                    Role
                  </th>
                  <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-sand-50 border-b">
                      {/* Avatar */}
                      <td className="px-5 py-3">
                        <div className="bg-sand-100 size-9 animate-pulse rounded-lg" />
                      </td>
                      {/* Name */}
                      <td className="px-5 py-3">
                        <div className="bg-sand-100 h-4 w-32 animate-pulse rounded" />
                      </td>
                      {/* Email */}
                      <td className="px-5 py-3">
                        <div className="bg-sand-100 h-4 w-44 animate-pulse rounded" />
                      </td>
                      {/* Phone */}
                      <td className="px-5 py-3">
                        <div className="bg-sand-100 h-4 w-28 animate-pulse rounded" />
                      </td>
                      {/* Role badge */}
                      <td className="px-5 py-3">
                        <div className="bg-sand-100 h-5 w-16 animate-pulse rounded-full" />
                      </td>
                      {/* Created */}
                      <td className="px-5 py-3">
                        <div className="bg-sand-100 h-4 w-24 animate-pulse rounded" />
                      </td>
                    </tr>
                  ))
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-petroleum-400 px-6 py-12 text-center"
                    >
                      No users yet.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => {
                    const badge = ROLE_BADGE[row.role] ?? ROLE_BADGE.contact!;
                    return (
                      <tr
                        key={row.id}
                        onClick={() => push(row.href)}
                        className="border-sand-50 hover:bg-sand-50 cursor-pointer border-b transition-colors"
                      >
                        <td className="px-5 py-3">
                          <div className="bg-sand-100 flex size-9 items-center justify-center rounded-lg">
                            <AvatarFallback />
                          </div>
                        </td>
                        <td className="text-petroleum-700 px-5 py-3 font-medium">
                          {row.name}
                        </td>
                        <td className="text-petroleum-400 px-5 py-3">
                          {row.email ?? "—"}
                        </td>
                        <td className="text-petroleum-400 px-5 py-3">
                          {row.phone ?? "—"}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="text-petroleum-400 px-5 py-3">
                          {formatDate(row.created_at)}
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

      {contacts.total > PAGE_SIZE && (
        <div className="border-sand-200 mt-4 rounded-2xl border bg-white">
          <Pagination
            page={contacts.page}
            totalPages={totalPages}
            onPage={(p) => dispatchContacts({ type: "SET_PAGE", page: p })}
            loading={contacts.loading}
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
