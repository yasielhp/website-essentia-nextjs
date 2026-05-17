"use client";

import { useEffect, useReducer, useCallback } from "react";
import { insforge } from "@/lib/insforge";

type TabKey = "bookings" | "members" | "races" | "education";

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

type TabData = {
  bookings: BookingRow[];
  members: MembershipRow[];
  races: RaceRegistrationRow[];
  education: EducationRegistrationRow[];
};

type TabLoaded = Record<TabKey, boolean>;
type TabLoading = Record<TabKey, boolean>;

type PageState = {
  active: TabKey;
  data: TabData;
  loaded: TabLoaded;
  loading: TabLoading;
};

type PageAction =
  | { type: "SET_TAB"; value: TabKey }
  | { type: "FETCH_START"; tab: TabKey }
  | { type: "FETCH_BOOKINGS"; rows: BookingRow[] }
  | { type: "FETCH_MEMBERS"; rows: MembershipRow[] }
  | { type: "FETCH_RACES"; rows: RaceRegistrationRow[] }
  | { type: "FETCH_EDUCATION"; rows: EducationRegistrationRow[] };

const initialState: PageState = {
  active: "bookings",
  data: { bookings: [], members: [], races: [], education: [] },
  loaded: { bookings: false, members: false, races: false, education: false },
  loading: { bookings: false, members: false, races: false, education: false },
};

function reducer(state: PageState, action: PageAction): PageState {
  switch (action.type) {
    case "SET_TAB":
      return { ...state, active: action.value };
    case "FETCH_START":
      return {
        ...state,
        loading: { ...state.loading, [action.tab]: true },
      };
    case "FETCH_BOOKINGS":
      return {
        ...state,
        data: { ...state.data, bookings: action.rows },
        loaded: { ...state.loaded, bookings: true },
        loading: { ...state.loading, bookings: false },
      };
    case "FETCH_MEMBERS":
      return {
        ...state,
        data: { ...state.data, members: action.rows },
        loaded: { ...state.loaded, members: true },
        loading: { ...state.loading, members: false },
      };
    case "FETCH_RACES":
      return {
        ...state,
        data: { ...state.data, races: action.rows },
        loaded: { ...state.loaded, races: true },
        loading: { ...state.loading, races: false },
      };
    case "FETCH_EDUCATION":
      return {
        ...state,
        data: { ...state.data, education: action.rows },
        loaded: { ...state.loaded, education: true },
        loading: { ...state.loading, education: false },
      };
  }
}

const TABS: { key: TabKey; label: string }[] = [
  { key: "bookings", label: "Bookings" },
  { key: "members", label: "Members" },
  { key: "races", label: "Races" },
  { key: "education", label: "Education" },
];

const statusBadgeClasses: Record<string, string> = {
  paid: "bg-green-50 text-green-700",
  confirmed: "bg-green-50 text-green-700",
  active: "bg-green-50 text-green-700",
  pending: "bg-yellow-50 text-yellow-700",
  failed: "bg-red-50 text-red-600",
  cancelled: "bg-red-50 text-red-600",
  expired: "bg-red-50 text-red-600",
  refunded: "bg-orange-50 text-orange-700",
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

function shortenId(id: string | null): string {
  if (!id) return "—";
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

type Column = { label: string; align?: "left" | "right" };

function TableShell({
  columns,
  loading,
  empty,
  children,
}: {
  columns: Column[];
  loading: boolean;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="border-sand-200 rounded-2xl border bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-sand-200 border-b text-left">
              {columns.map((c) => (
                <th
                  key={c.label}
                  className={`text-petroleum-400 px-5 py-3.5 text-xs font-medium ${
                    c.align === "right" ? "text-right" : ""
                  }`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-sand-50 border-b">
                  {columns.map((_c, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="bg-sand-100 h-4 animate-pulse rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : empty ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-petroleum-400 px-6 py-12 text-center"
                >
                  No transactions found.
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const BOOKINGS_COLUMNS: Column[] = [
  { label: "Service" },
  { label: "Client" },
  { label: "Date" },
  { label: "Amount", align: "right" },
  { label: "Status" },
  { label: "Created" },
];

const MEMBERS_COLUMNS: Column[] = [
  { label: "Plan" },
  { label: "Member" },
  { label: "Start Date" },
  { label: "End Date" },
  { label: "Status" },
  { label: "Amount", align: "right" },
];

const RACES_COLUMNS: Column[] = [
  { label: "Race" },
  { label: "Registrant" },
  { label: "Registration Date" },
  { label: "Status" },
];

const EDUCATION_COLUMNS: Column[] = [
  { label: "Session" },
  { label: "Registrant" },
  { label: "Registration Date" },
  { label: "Status" },
];

export default function TransactionsPage() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { active, data, loaded, loading } = state;

  const fetchBookings = useCallback(async () => {
    dispatch({ type: "FETCH_START", tab: "bookings" });
    const { data: rows } = await insforge.database
      .from("bookings")
      .select(
        "id, service_title, first_name, last_name, date, status, payment_status, price_eur, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    dispatch({
      type: "FETCH_BOOKINGS",
      rows: (rows as BookingRow[] | null) ?? [],
    });
  }, []);

  const fetchMembers = useCallback(async () => {
    dispatch({ type: "FETCH_START", tab: "members" });
    const { data: rows } = await insforge.database
      .from("memberships")
      .select(
        "id, contact_id, status, start_date, end_date, created_at, contacts(first_name, last_name)",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    dispatch({
      type: "FETCH_MEMBERS",
      rows: (rows as MembershipRow[] | null) ?? [],
    });
  }, []);

  const fetchRaces = useCallback(async () => {
    dispatch({ type: "FETCH_START", tab: "races" });
    const { data: rows } = await insforge.database
      .from("race_registrations")
      .select(
        "id, contact_id, race_id, created_at, races(title), contacts(first_name, last_name)",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    dispatch({
      type: "FETCH_RACES",
      rows: (rows as RaceRegistrationRow[] | null) ?? [],
    });
  }, []);

  const fetchEducation = useCallback(async () => {
    dispatch({ type: "FETCH_START", tab: "education" });
    const { data: rows } = await insforge.database
      .from("education_registrations")
      .select(
        "id, contact_id, session_id, created_at, education_sessions(title), contacts(first_name, last_name)",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    dispatch({
      type: "FETCH_EDUCATION",
      rows: (rows as EducationRegistrationRow[] | null) ?? [],
    });
  }, []);

  useEffect(() => {
    if (loaded[active] || loading[active]) return;
    switch (active) {
      case "bookings":
        void fetchBookings();
        return;
      case "members":
        void fetchMembers();
        return;
      case "races":
        void fetchRaces();
        return;
      case "education":
        void fetchEducation();
        return;
    }
  }, [
    active,
    loaded,
    loading,
    fetchBookings,
    fetchMembers,
    fetchRaces,
    fetchEducation,
  ]);

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="mb-8">
        <h1 className="font-display text-petroleum-700 text-3xl">
          Transactions
        </h1>
        <p className="text-petroleum-400 mt-1 text-sm">
          Review payments and registrations across the platform.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Transaction categories"
        className="border-sand-200 mb-6 flex flex-wrap gap-1 border-b"
      >
        {TABS.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => dispatch({ type: "SET_TAB", value: t.key })}
              className={`relative -mb-px rounded-t-md px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "text-petroleum-700 border-petroleum-700 border-b-2"
                  : "text-petroleum-400 hover:text-petroleum-600 border-b-2 border-transparent"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {active === "bookings" && (
        <TableShell
          columns={BOOKINGS_COLUMNS}
          loading={loading.bookings || (!loaded.bookings && !loading.bookings)}
          empty={loaded.bookings && data.bookings.length === 0}
        >
          {data.bookings.map((row) => {
            const client =
              [row.first_name, row.last_name].filter(Boolean).join(" ") || "—";
            return (
              <tr
                key={row.id}
                className="border-sand-50 hover:bg-sand-50 border-b transition-colors"
              >
                <td className="text-petroleum-700 px-5 py-4 font-medium">
                  {row.service_title ?? "—"}
                </td>
                <td className="text-petroleum-500 px-5 py-4">{client}</td>
                <td className="text-petroleum-500 px-5 py-4">
                  {formatDate(row.date)}
                </td>
                <td className="text-petroleum-700 px-5 py-4 text-right font-medium">
                  {formatAmount(row.price_eur)}
                </td>
                <td className="px-5 py-4">
                  <StatusBadge status={row.payment_status ?? row.status} />
                </td>
                <td className="text-petroleum-400 px-5 py-4">
                  {formatDate(row.created_at)}
                </td>
              </tr>
            );
          })}
        </TableShell>
      )}

      {active === "members" && (
        <TableShell
          columns={MEMBERS_COLUMNS}
          loading={loading.members || (!loaded.members && !loading.members)}
          empty={loaded.members && data.members.length === 0}
        >
          {data.members.map((row) => {
            const member = row.contacts
              ? [row.contacts.first_name, row.contacts.last_name]
                  .filter(Boolean)
                  .join(" ") || "—"
              : shortenId(row.contact_id);
            return (
              <tr
                key={row.id}
                className="border-sand-50 hover:bg-sand-50 border-b transition-colors"
              >
                <td className="text-petroleum-700 px-5 py-4 font-medium">
                  Membership
                </td>
                <td className="text-petroleum-500 px-5 py-4">{member}</td>
                <td className="text-petroleum-500 px-5 py-4">
                  {formatDate(row.start_date)}
                </td>
                <td className="text-petroleum-500 px-5 py-4">
                  {formatDate(row.end_date)}
                </td>
                <td className="px-5 py-4">
                  <StatusBadge status={row.status} />
                </td>
                <td className="text-petroleum-700 px-5 py-4 text-right font-medium">
                  {formatAmount(null)}
                </td>
              </tr>
            );
          })}
        </TableShell>
      )}

      {active === "races" && (
        <TableShell
          columns={RACES_COLUMNS}
          loading={loading.races || (!loaded.races && !loading.races)}
          empty={loaded.races && data.races.length === 0}
        >
          {data.races.map((row) => {
            const raceTitle = row.races?.title ?? shortenId(row.race_id);
            const registrant = row.contacts
              ? [row.contacts.first_name, row.contacts.last_name]
                  .filter(Boolean)
                  .join(" ") || "—"
              : shortenId(row.contact_id);
            return (
              <tr
                key={row.id}
                className="border-sand-50 hover:bg-sand-50 border-b transition-colors"
              >
                <td className="text-petroleum-700 px-5 py-4 font-medium">
                  {raceTitle}
                </td>
                <td className="text-petroleum-500 px-5 py-4">{registrant}</td>
                <td className="text-petroleum-500 px-5 py-4">
                  {formatDate(row.created_at)}
                </td>
                <td className="px-5 py-4">
                  <StatusBadge status="confirmed" />
                </td>
              </tr>
            );
          })}
        </TableShell>
      )}

      {active === "education" && (
        <TableShell
          columns={EDUCATION_COLUMNS}
          loading={
            loading.education || (!loaded.education && !loading.education)
          }
          empty={loaded.education && data.education.length === 0}
        >
          {data.education.map((row) => {
            const sessionTitle =
              row.education_sessions?.title ?? shortenId(row.session_id);
            const registrant = row.contacts
              ? [row.contacts.first_name, row.contacts.last_name]
                  .filter(Boolean)
                  .join(" ") || "—"
              : shortenId(row.contact_id);
            return (
              <tr
                key={row.id}
                className="border-sand-50 hover:bg-sand-50 border-b transition-colors"
              >
                <td className="text-petroleum-700 px-5 py-4 font-medium">
                  {sessionTitle}
                </td>
                <td className="text-petroleum-500 px-5 py-4">{registrant}</td>
                <td className="text-petroleum-500 px-5 py-4">
                  {formatDate(row.created_at)}
                </td>
                <td className="px-5 py-4">
                  <StatusBadge status="confirmed" />
                </td>
              </tr>
            );
          })}
        </TableShell>
      )}
    </div>
  );
}
