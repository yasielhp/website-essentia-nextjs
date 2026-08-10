"use client";

import { useEffect, useReducer, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import {
  AddContactModal,
  NotFoundState,
  PageHeader,
  RegistrationsSummary,
  RegistrationsTable,
} from "./registration-sections";
import type { Contact, Race, Registration } from "./types";

type State = {
  race: Race | null;
  registrations: Registration[];
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
  | { type: "LOAD_SUCCESS"; race: Race }
  | { type: "SET_REGISTRATIONS"; registrations: Registration[] }
  | { type: "OPEN_ADD"; contacts: Contact[] }
  | { type: "CONTACTS_LOADING" }
  | { type: "CLOSE_ADD" }
  | { type: "SET_SEARCH"; search: string }
  | { type: "SET_REMOVE_OPEN"; id: string | null }
  | { type: "REMOVING_START"; id: string }
  | { type: "REMOVING_DONE" }
  | { type: "ADDING_START"; id: string }
  | { type: "ADDING_DONE" };

const initialState: State = {
  race: null,
  registrations: [],
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
      return {
        ...state,
        loading: false,
        race: action.race,
      };
    case "SET_REGISTRATIONS":
      return { ...state, registrations: action.registrations };
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

export default function RaceRegistrationsPage() {
  const { id } = useParams<{ id: string }>();
  const { back } = useRouter();

  const [state, dispatch] = useReducer(reducer, initialState);

  const {
    race,
    registrations,
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

  const loadRegistrations = useCallback(async () => {
    const { data: regs } = await insforge.database
      .from("race_registrations")
      .select(
        "id, user_id, contact_id, created_at, table_number, checked_in_at",
      )
      .eq("race_id", id)
      .order("table_number", { ascending: true });

    if (!regs || (regs as unknown[]).length === 0) {
      dispatch({ type: "SET_REGISTRATIONS", registrations: [] });
      return;
    }

    const regList = regs as {
      id: string;
      user_id: string | null;
      contact_id: string | null;
      created_at: string;
      table_number: number | null;
      checked_in_at: string | null;
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
      type: "SET_REGISTRATIONS",
      registrations: regList.map((r) => {
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
          table_number: r.table_number,
          checked_in_at: r.checked_in_at,
        };
      }),
    });
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      dispatch({ type: "LOAD_START" });

      const { data: raceData } = await insforge.database
        .from("races")
        .select("id, title, date, max_participants")
        .eq("id", id)
        .limit(1);

      if (cancelled) return;

      const raceRow = (raceData as Race[] | null)?.[0];
      if (!raceRow) {
        dispatch({ type: "NOT_FOUND" });
        return;
      }

      await loadRegistrations();

      if (cancelled) return;

      dispatch({ type: "LOAD_SUCCESS", race: raceRow });
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [id, loadRegistrations]);

  async function handleRemove(regId: string) {
    dispatch({ type: "REMOVING_START", id: regId });
    await insforge.database.from("race_registrations").delete().eq("id", regId);
    dispatch({ type: "REMOVING_DONE" });
    await loadRegistrations();
  }

  async function openAdd() {
    dispatch({ type: "CONTACTS_LOADING" });

    const registeredContactIds = new Set(
      registrations.flatMap((r) => (r.contact_id ? [r.contact_id] : [])),
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
      .from("race_registrations")
      .insert([{ race_id: id, contact_id: contact.id }]);
    dispatch({ type: "ADDING_DONE" });
    await loadRegistrations();
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
    return <NotFoundState onBack={() => back()} />;
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <PageHeader
        raceId={id}
        title={race?.title}
        loading={loading}
        onAddOpen={openAdd}
      />

      <div className="border-sand-200 rounded-2xl border bg-white">
        {!loading && (
          <RegistrationsSummary
            date={race?.date ?? null}
            count={registrations.length}
            maxParticipants={race?.max_participants ?? null}
          />
        )}
        <RegistrationsTable
          loading={loading}
          registrations={registrations}
          removeOpen={removeOpen}
          removingId={removingId}
          onConfirmOpen={(regId) =>
            dispatch({ type: "SET_REMOVE_OPEN", id: regId })
          }
          onConfirmClose={() => dispatch({ type: "SET_REMOVE_OPEN", id: null })}
          onRemove={(regId) => void handleRemove(regId)}
        />
      </div>

      {addOpen && (
        <AddContactModal
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
