"use client";

import { useEffect, useReducer, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { insforge } from "@/lib/insforge";
import { TIME_ZONE } from "@/utils/format";
import { AddEnrolleeModal, EnrolleeRow, PageHeader } from "./enrollee-sections";
import type { Contact, Enrollee, Session } from "./types";

type State = {
  session: Session | null;
  enrollees: Enrollee[];
  contacts: Contact[];
  loading: boolean;
  notFound: boolean;
  contactsLoading: boolean;
  removingId: string | null;
  addingId: string | null;
  removeOpen: string | null;
  addOpen: boolean;
  search: string;
};

type Action =
  | { type: "LOAD_START" }
  | { type: "NOT_FOUND" }
  | { type: "LOAD_SUCCESS"; session: Session }
  | { type: "SET_ENROLLEES"; enrollees: Enrollee[] }
  | { type: "CONTACTS_LOADING" }
  | { type: "OPEN_ADD"; contacts: Contact[] }
  | { type: "CLOSE_ADD" }
  | { type: "SET_SEARCH"; search: string }
  | { type: "SET_REMOVE_OPEN"; id: string | null }
  | { type: "REMOVING_START"; id: string }
  | { type: "REMOVING_DONE" }
  | { type: "ADDING_START"; id: string }
  | { type: "ADDING_DONE" };

const initialState: State = {
  session: null,
  enrollees: [],
  contacts: [],
  loading: true,
  notFound: false,
  contactsLoading: false,
  removingId: null,
  addingId: null,
  removeOpen: null,
  addOpen: false,
  search: "",
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOAD_START":
      return { ...state, loading: true, notFound: false };
    case "NOT_FOUND":
      return { ...state, loading: false, notFound: true };
    case "LOAD_SUCCESS":
      return { ...state, loading: false, session: action.session };
    case "SET_ENROLLEES":
      return { ...state, enrollees: action.enrollees };
    case "CONTACTS_LOADING":
      return { ...state, contactsLoading: true };
    case "OPEN_ADD":
      return {
        ...state,
        addOpen: true,
        contactsLoading: false,
        contacts: action.contacts,
        search: "",
      };
    case "CLOSE_ADD":
      return { ...state, addOpen: false, search: "" };
    case "SET_SEARCH":
      return { ...state, search: action.search };
    case "SET_REMOVE_OPEN":
      return { ...state, removeOpen: action.id };
    case "REMOVING_START":
      return { ...state, removingId: action.id };
    case "REMOVING_DONE":
      return { ...state, removingId: null, removeOpen: null };
    case "ADDING_START":
      return { ...state, addingId: action.id };
    case "ADDING_DONE":
      return { ...state, addingId: null, addOpen: false };
    default:
      return state;
  }
}

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: TIME_ZONE,
  });
}

export default function EnrolleesPage() {
  const t = useTranslations("dashboard.education.enrollees");
  const locale = useLocale();
  const { id } = useParams<{ id: string }>();
  const { back } = useRouter();

  const [state, dispatch] = useReducer(reducer, initialState);

  const {
    session,
    enrollees,
    contacts,
    loading,
    notFound,
    contactsLoading,
    removingId,
    addingId,
    removeOpen,
    addOpen,
    search,
  } = state;

  const loadEnrollees = useCallback(async () => {
    const { data: regs } = await insforge.database
      .from("education_registrations")
      .select("id, user_id, contact_id, created_at")
      .eq("session_id", id)
      .order("created_at", { ascending: true });

    if (!regs || (regs as unknown[]).length === 0) {
      dispatch({ type: "SET_ENROLLEES", enrollees: [] });
      return;
    }

    const regList = regs as {
      id: string;
      user_id: string | null;
      contact_id: string | null;
      created_at: string;
    }[];

    const contactIds = regList.flatMap((r) =>
      r.contact_id ? [r.contact_id] : [],
    );
    const userIds = regList.flatMap((r) => (r.user_id ? [r.user_id] : []));

    const contactMap: Record<
      string,
      { full_name: string | null; email: string | null; phone: string | null }
    > = {};
    const profileMap: Record<
      string,
      { full_name: string | null; email: string | null }
    > = {};

    if (contactIds.length > 0) {
      const { data } = await insforge.database
        .from("contacts")
        .select("id, first_name, last_name, email, phone")
        .in("id", contactIds);
      if (data) {
        for (const c of data as {
          id: string;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          phone: string | null;
        }[]) {
          contactMap[c.id] = {
            full_name:
              [c.first_name, c.last_name].filter(Boolean).join(" ") || null,
            email: c.email,
            phone: c.phone,
          };
        }
      }
    }

    if (userIds.length > 0) {
      const { data } = await insforge.database
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      if (data) {
        for (const p of data as {
          id: string;
          full_name: string | null;
          email: string | null;
        }[]) {
          profileMap[p.id] = { full_name: p.full_name, email: p.email };
        }
      }
    }

    dispatch({
      type: "SET_ENROLLEES",
      enrollees: regList.map((r) => {
        const c = r.contact_id ? contactMap[r.contact_id] : null;
        const p = r.user_id ? profileMap[r.user_id] : null;
        return {
          id: r.id,
          contact_id: r.contact_id,
          profile_id: r.user_id,
          full_name: c?.full_name ?? p?.full_name ?? null,
          email: c?.email ?? p?.email ?? null,
          phone: c?.phone ?? null,
          registered_at: r.created_at,
        };
      }),
    });
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      dispatch({ type: "LOAD_START" });

      const { data: sessionData } = await insforge.database
        .from("education_sessions")
        .select("id, title, date, max_participants")
        .eq("id", id)
        .limit(1);

      if (cancelled) return;

      const sessionRow = (sessionData as Session[] | null)?.[0];
      if (!sessionRow) {
        dispatch({ type: "NOT_FOUND" });
        return;
      }

      await loadEnrollees();

      if (cancelled) return;

      dispatch({ type: "LOAD_SUCCESS", session: sessionRow });
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [id, loadEnrollees]);

  async function handleRemove(enrolleeId: string) {
    dispatch({ type: "REMOVING_START", id: enrolleeId });
    await insforge.database
      .from("education_registrations")
      .delete()
      .eq("id", enrolleeId);
    dispatch({ type: "REMOVING_DONE" });
    await loadEnrollees();
  }

  async function openAdd() {
    dispatch({ type: "CONTACTS_LOADING" });

    const registeredContactIds = new Set(
      enrollees.flatMap((e) => (e.contact_id ? [e.contact_id] : [])),
    );

    const { data } = await insforge.database
      .from("contacts")
      .select("id, first_name, last_name, email, phone")
      .order("first_name", { ascending: true });

    const all =
      (data as
        | {
            id: string;
            first_name: string | null;
            last_name: string | null;
            email: string | null;
            phone: string | null;
          }[]
        | null) ?? [];

    dispatch({
      type: "OPEN_ADD",
      contacts: all.flatMap((c) =>
        registeredContactIds.has(c.id)
          ? []
          : [
              {
                id: c.id,
                full_name:
                  [c.first_name, c.last_name].filter(Boolean).join(" ") || "—",
                email: c.email,
                phone: c.phone,
              },
            ],
      ),
    });
  }

  async function handleAddContact(contact: Contact) {
    dispatch({ type: "ADDING_START", id: contact.id });
    await insforge.database
      .from("education_registrations")
      .insert([{ session_id: id, contact_id: contact.id }]);
    dispatch({ type: "ADDING_DONE" });
    await loadEnrollees();
  }

  const filteredContacts = contacts.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.full_name.toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      String(c.phone ?? "").includes(q)
    );
  });

  if (notFound) {
    return (
      <div className="text-petroleum-400 flex flex-col items-center justify-center py-24">
        <p className="text-sm">{t("notFound")}</p>
        <button
          onClick={() => back()}
          className="hover:text-petroleum-700 mt-4 text-xs underline"
        >
          {t("goBack")}
        </button>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <PageHeader
        title={session?.title}
        loading={loading}
        onAddOpen={openAdd}
      />

      <div className="border-sand-200 rounded-2xl border bg-white">
        {!loading && session && (
          <div className="border-sand-100 flex items-center justify-between border-b px-5 py-3">
            <p className="text-petroleum-400 text-sm">
              {formatDate(session.date, locale)}
            </p>
            <p className="text-petroleum-400 text-sm">
              {t("count", { count: enrollees.length })}
              {session.max_participants != null && (
                <span
                  className={
                    enrollees.length >= session.max_participants
                      ? "font-medium text-red-500"
                      : ""
                  }
                >
                  {t("ofMax", { max: session.max_participants })}
                </span>
              )}
            </p>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-140 text-sm">
            <thead>
              <tr className="border-sand-200 border-b text-left">
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  #
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("columns.name")}
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("columns.email")}
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("columns.phone")}
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  {t("columns.enrolledAt")}
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-sand-50 border-b">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="bg-sand-100 h-4 animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : enrollees.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-petroleum-400 px-6 py-12 text-center"
                  >
                    {t("empty")}
                  </td>
                </tr>
              ) : (
                enrollees.map((enrollee, index) => (
                  <EnrolleeRow
                    key={enrollee.id}
                    enrollee={enrollee}
                    index={index}
                    removeOpen={removeOpen}
                    removingId={removingId}
                    onConfirmOpen={(enrolleeId) =>
                      dispatch({ type: "SET_REMOVE_OPEN", id: enrolleeId })
                    }
                    onConfirmClose={() =>
                      dispatch({ type: "SET_REMOVE_OPEN", id: null })
                    }
                    onRemove={(enrolleeId) => void handleRemove(enrolleeId)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {addOpen && (
        <AddEnrolleeModal
          search={search}
          contactsLoading={contactsLoading}
          filteredContacts={filteredContacts}
          addingId={addingId}
          onClose={() => dispatch({ type: "CLOSE_ADD" })}
          onSearch={(value) => dispatch({ type: "SET_SEARCH", search: value })}
          onAdd={(contact) => void handleAddContact(contact)}
        />
      )}
    </div>
  );
}
