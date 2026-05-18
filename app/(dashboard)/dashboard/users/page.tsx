"use client";

import { useEffect, useReducer, useCallback, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/dashboard/pagination";

// ─── Types ────────────────────────────────────────────────────

type Tab = "contacts" | "system";

type ContactRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string | null;
};

type LastBooking = { contact_id: string; created_at: string | null };

type SystemRole = "admin" | "staff" | "partner";

type SystemUserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: SystemRole;
};

// ─── Constants ────────────────────────────────────────────────

const PAGE_SIZE = 20;

const ROLE_BADGE: Record<SystemRole, { label: string; cls: string }> = {
  admin: { label: "Admin", cls: "bg-petroleum-100 text-petroleum-700" },
  staff: { label: "Staff", cls: "bg-blue-100 text-blue-700" },
  partner: { label: "Partner", cls: "bg-amber-100 text-amber-700" },
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

// ─── Contacts tab state ───────────────────────────────────────

type ContactsState = {
  contacts: ContactRow[];
  lastBookings: Map<string, LastBooking>;
  loading: boolean;
  total: number;
  page: number;
};

type ContactsAction =
  | { type: "SET_LOADING" }
  | {
      type: "LOADED";
      contacts: ContactRow[];
      bookings: LastBooking[];
      total: number;
    }
  | { type: "SET_PAGE"; page: number };

function contactsReducer(
  state: ContactsState,
  action: ContactsAction,
): ContactsState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: true };
    case "LOADED": {
      const map = new Map<string, LastBooking>();
      for (const b of action.bookings) {
        if (!map.has(b.contact_id)) map.set(b.contact_id, b);
      }
      return {
        ...state,
        loading: false,
        contacts: action.contacts,
        lastBookings: map,
        total: action.total,
      };
    }
    case "SET_PAGE":
      return { ...state, page: action.page };
  }
}

// ─── System users tab state ───────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────

export default function UsersPage() {
  const { push } = useRouter();
  const [tab, setTab] = useState<Tab>("contacts");

  const [contacts, dispatchContacts] = useReducer(contactsReducer, {
    contacts: [],
    lastBookings: new Map(),
    loading: true,
    total: 0,
    page: 0,
  });

  const [system, dispatchSystem] = useReducer(systemReducer, {
    users: [],
    loading: false,
  });

  const systemFetched = useRef(false);

  // ── Load contacts ──
  const loadContacts = useCallback(async (page: number) => {
    dispatchContacts({ type: "SET_LOADING" });
    const { data, count } = await insforge.database
      .from("contacts")
      .select("id, first_name, last_name, email, phone, created_at", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    const list = (data as ContactRow[] | null) ?? [];
    let bookings: LastBooking[] = [];
    if (list.length > 0) {
      const ids = list.map((c) => c.id);
      const { data: bd } = await insforge.database
        .from("bookings")
        .select("contact_id, created_at")
        .in("contact_id", ids)
        .order("created_at", { ascending: false });
      bookings = (bd as LastBooking[] | null) ?? [];
    }

    dispatchContacts({
      type: "LOADED",
      contacts: list,
      bookings,
      total: count ?? 0,
    });
  }, []);

  useEffect(() => {
    void loadContacts(contacts.page);
  }, [loadContacts, contacts.page]);

  // ── Load system users (lazy) ──
  useEffect(() => {
    if (tab !== "system" || systemFetched.current) return;
    systemFetched.current = true;
    dispatchSystem({ type: "SET_LOADING" });
    insforge.database
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
  }, [tab, systemFetched]);

  const totalPages = Math.max(1, Math.ceil(contacts.total / PAGE_SIZE));

  return (
    <div className="px-6 py-8 lg:px-10">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-petroleum-700 text-3xl">Users</h1>
          <p className="text-petroleum-400 mt-1 text-sm">
            {tab === "contacts"
              ? `${contacts.total} contact${contacts.total !== 1 ? "s" : ""}`
              : `${system.users.length} system user${system.users.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        {tab === "contacts" ? (
          <Button
            variant="solid"
            size="md"
            href="/dashboard/contacts/new"
            className="gap-2 self-start"
          >
            <IconPlus />
            Add contact
          </Button>
        ) : (
          <Button
            variant="solid"
            size="md"
            href="/dashboard/users/new"
            className="gap-2 self-start"
          >
            <IconPlus />
            Add user
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div role="tablist" className="border-sand-200 mb-6 flex gap-1 border-b">
        {(
          [
            ["contacts", "Contacts"],
            ["system", "System users"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`relative -mb-px px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === key
                ? "border-petroleum-700 text-petroleum-700 border-b-2"
                : "text-petroleum-400 hover:text-petroleum-600 border-b-2 border-transparent"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Contacts tab ── */}
      {tab === "contacts" && (
        <div className="border-sand-200 rounded-2xl border bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-sand-200 border-b text-left">
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
                    Last booking
                  </th>
                  <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {contacts.loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-sand-50 border-b">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-5 py-4">
                          <div className="bg-sand-100 h-4 animate-pulse rounded" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : contacts.contacts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="text-petroleum-400 px-6 py-12 text-center"
                    >
                      No contacts yet.
                    </td>
                  </tr>
                ) : (
                  contacts.contacts.map((c) => {
                    const last = contacts.lastBookings.get(c.id);
                    const name =
                      [c.first_name, c.last_name].filter(Boolean).join(" ") ||
                      "—";
                    return (
                      <tr
                        key={c.id}
                        onClick={() => push(`/dashboard/contacts/${c.id}`)}
                        className="border-sand-50 hover:bg-sand-50 cursor-pointer border-b transition-colors"
                      >
                        <td className="text-petroleum-700 px-5 py-4 font-medium">
                          {name}
                        </td>
                        <td className="text-petroleum-400 px-5 py-4">
                          {c.email ?? "—"}
                        </td>
                        <td className="text-petroleum-400 px-5 py-4">
                          {c.phone ?? "—"}
                        </td>
                        <td className="text-petroleum-400 px-5 py-4">
                          {last ? formatDate(last.created_at) : "—"}
                        </td>
                        <td className="text-petroleum-400 px-5 py-4">
                          {formatDate(c.created_at)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={contacts.page}
            totalPages={totalPages}
            onPage={(p) => dispatchContacts({ type: "SET_PAGE", page: p })}
            loading={contacts.loading}
          />
        </div>
      )}

      {/* ── System users tab ── */}
      {tab === "system" && (
        <div className="border-sand-200 rounded-2xl border bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
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
                </tr>
              </thead>
              <tbody>
                {system.loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-sand-50 border-b">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-5 py-4">
                          <div className="bg-sand-100 h-4 animate-pulse rounded" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : system.users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="text-petroleum-400 px-6 py-12 text-center"
                    >
                      No system users found.
                    </td>
                  </tr>
                ) : (
                  system.users.map((u) => {
                    const badge = ROLE_BADGE[u.role];
                    return (
                      <tr
                        key={u.id}
                        onClick={() => push(`/dashboard/users/${u.id}`)}
                        className="border-sand-50 hover:bg-sand-50 cursor-pointer border-b transition-colors"
                      >
                        <td className="px-5 py-3">
                          <div className="bg-sand-100 flex size-9 items-center justify-center rounded-lg">
                            <AvatarFallback />
                          </div>
                        </td>
                        <td className="text-petroleum-700 px-5 py-3 font-medium">
                          {u.full_name ?? "—"}
                        </td>
                        <td className="text-petroleum-400 px-5 py-3">
                          {u.email ?? "—"}
                        </td>
                        <td className="text-petroleum-400 px-5 py-3">
                          {u.phone ?? "—"}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
