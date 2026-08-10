"use client";

import { useEffect, useReducer, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { insforge } from "@/lib/insforge";
import { useDashboardLocale } from "@/hooks/use-dashboard-locale";
import { getAccessToken } from "@/lib/client-session";
import { fetchContacts, fetchContactRoleCounts } from "@/actions/contacts";
import type { ContactRow, ContactStatus } from "@/types/contact";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/dashboard/pagination";
import { StatCard } from "@/components/dashboard/calendar/stat-card";
import { IconPlus, IconFilter } from "@/components/ui/icons";
import { UserTable } from "./user-table";
import type { DisplayRow } from "./types";

// ─── Types ────────────────────────────────────────────────────

type SystemRole = "admin" | "staff" | "partner";

type SystemUserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  gender: string | null;
  role: SystemRole;
};

// ─── Constants ────────────────────────────────────────────────

const PAGE_SIZE = 20;

// ─── Helpers ──────────────────────────────────────────────────

const fieldCls =
  "border-sand-200 text-petroleum-500 placeholder:text-petroleum-300 w-full rounded-xl border bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-petroleum-300";

type UserFilter = { role: string; email: string };
const emptyUserFilter: UserFilter = { role: "", email: "" };

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
  { type: "SET_LOADING" } | { type: "LOADED"; users: SystemUserRow[] };

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
              {t("users.filters.email")}
            </span>
            <input
              type="search"
              value={pending.email}
              onChange={(e) => onChange("email", e.target.value)}
              placeholder={t("users.filters.emailPlaceholder")}
              className={fieldCls}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-petroleum-400 text-xs font-medium">
              {t("users.filters.role")}
            </span>
            <select
              value={pending.role}
              onChange={(e) => onChange("role", e.target.value)}
              className={fieldCls}
            >
              <option value="">{t("users.filters.allRoles")}</option>
              <option value="lead">{t("users.roles.lead")}</option>
              <option value="client">{t("users.roles.client")}</option>
              <option value="member">{t("users.roles.member")}</option>
              <option value="staff">{t("users.roles.staff")}</option>
              <option value="partner">{t("users.roles.partner")}</option>
              <option value="admin">{t("users.roles.admin")}</option>
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

// ─── Page ─────────────────────────────────────────────────────

export default function UsersPage() {
  const t = useTranslations("dashboard");
  const locale = useDashboardLocale();
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
    members: number | null;
    staff: number | null;
    partner: number | null;
    admin: number | null;
  }>({
    leads: null,
    clients: null,
    members: null,
    staff: null,
    partner: null,
    admin: null,
  });

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
    dispatchContacts({ type: "SET_PAGE", page: 0 });
    setFilterOpen(false);
  }
  function clearFilters() {
    setAppliedFilter(emptyUserFilter);
    setPendingFilter(emptyUserFilter);
    dispatchContacts({ type: "SET_PAGE", page: 0 });
    setFilterOpen(false);
  }

  // Contact statuses are filtered by the database; the three account roles live
  // in `profiles` and are filtered from the fully-loaded system list below.
  const contactStatusFilter: ContactStatus | undefined =
    appliedFilter.role === "lead" ||
    appliedFilter.role === "client" ||
    appliedFilter.role === "member"
      ? appliedFilter.role
      : undefined;
  const accountRoleFilter = ["admin", "staff", "partner"].includes(
    appliedFilter.role,
  )
    ? appliedFilter.role
    : null;

  // ── Load contacts ──
  const loadContacts = useCallback(
    async (page: number, status: ContactStatus | undefined, email: string) => {
      dispatchContacts({ type: "SET_LOADING" });
      const { contacts, total } = await fetchContacts(
        getAccessToken(),
        page,
        PAGE_SIZE,
        status,
        email,
      );
      dispatchContacts({ type: "LOADED", contacts, total });
    },
    [],
  );

  useEffect(() => {
    void loadContacts(contacts.page, contactStatusFilter, appliedFilter.email);
  }, [loadContacts, contacts.page, contactStatusFilter, appliedFilter.email]);

  // ── Load system users (eager) ──
  useEffect(() => {
    dispatchSystem({ type: "SET_LOADING" });
    void insforge.database
      .from("profiles")
      .select("id, full_name, email, phone, gender, role")
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
      fetchContactRoleCounts(getAccessToken()),
      insforge.database
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "staff"),
      insforge.database
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "partner"),
      // Admins have no card of their own, but they appear in the list below, so
      // the total would be short by them if it were only the sum of the cards.
      insforge.database
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin"),
    ]).then(([contactCounts, staff, partner, admin]) => {
      setRoleCounts({
        leads: contactCounts.leads,
        clients: contactCounts.clients,
        // Contacts marked as members, not active subscriptions: every card on
        // this page counts people, and the subscription figure lives on the
        // Subscriptions screen.
        members: contactCounts.members,
        staff: (staff as { count: number | null }).count ?? 0,
        partner: (partner as { count: number | null }).count ?? 0,
        admin: (admin as { count: number | null }).count ?? 0,
      });
    });
  }, []);

  // Every card is drawn from these same figures, so the total is their sum
  // rather than a separate query that could disagree with them.
  const countsLoaded = Object.values(roleCounts).every((c) => c !== null);
  const totalUsers = countsLoaded
    ? Object.values(roleCounts).reduce((sum, c) => sum! + c!, 0)!
    : null;

  const totalPages = Math.max(1, Math.ceil(contacts.total / PAGE_SIZE));
  const isFirstPage = contacts.page === 0;
  const loading = contacts.loading || system.loading;

  // Merge: system users first (only on page 0), then contacts
  const systemRows: DisplayRow[] = system.users.map((u) => ({
    id: u.id,
    name: u.full_name ?? t("common.empty"),
    email: u.email,
    phone: u.phone,
    gender: u.gender,
    role: u.role,
    created_at: null,
    href: `/dashboard/users/${u.id}`,
  }));

  const contactRows: DisplayRow[] = contacts.contacts.map((c) => ({
    id: c.id,
    name: [c.first_name, c.last_name].filter(Boolean).join(" ") || "—",
    email: c.email,
    phone: c.phone,
    gender: c.gender,
    role: c.status ?? "lead",
    created_at: c.created_at,
    href: `/dashboard/contacts/${c.id}`,
  }));

  // Filtering by an account role hides contacts entirely, and vice versa: the
  // two live in different tables and a page of one cannot contain the other.
  const emailFilter = appliedFilter.email.trim();

  const displayRows: DisplayRow[] = accountRoleFilter
    ? systemRows.filter(
        (r) =>
          r.role === accountRoleFilter &&
          (!emailFilter ||
            (r.email ?? "").toLowerCase().includes(emailFilter.toLowerCase())),
      )
    : contactStatusFilter || emailFilter
      ? contactRows
      : isFirstPage
        ? [...systemRows, ...contactRows]
        : contactRows;

  const filteredRows = displayRows;

  return (
    <div className="px-6 py-8 lg:px-10">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <Button
          variant="solid"
          size="md"
          href="/dashboard/users/new"
          className="gap-2"
        >
          <IconPlus />
          {t("users.addUser")}
        </Button>
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
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-6">
        <StatCard
          label={t("users.stats.leads")}
          value={roleCounts.leads ?? 0}
          loading={roleCounts.leads === null}
        />
        <StatCard
          label={t("users.stats.clients")}
          value={roleCounts.clients ?? 0}
          loading={roleCounts.clients === null}
        />
        <StatCard
          label={t("users.stats.members")}
          value={roleCounts.members ?? 0}
          loading={roleCounts.members === null}
        />
        <StatCard
          label={t("users.stats.staff")}
          value={roleCounts.staff ?? 0}
          loading={roleCounts.staff === null}
        />
        <StatCard
          label={t("users.stats.partners")}
          value={roleCounts.partner ?? 0}
          loading={roleCounts.partner === null}
        />
        <StatCard
          label={t("users.stats.total")}
          value={totalUsers ?? 0}
          loading={totalUsers === null}
        />
      </div>

      <UserTable
        rows={filteredRows}
        loading={loading}
        locale={locale}
        onOpen={(row) => push(row.href)}
      />

      {!accountRoleFilter && contacts.total > PAGE_SIZE && (
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
