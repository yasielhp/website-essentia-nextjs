"use client";

import { useEffect, useReducer, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import {
  IconPlus,
  IconTrash,
  IconX,
  IconSearch,
  IconSpinner,
} from "@/components/ui/icons";

type Session = {
  id: string;
  title: string;
  date: string;
  max_participants: number | null;
};

type Enrollee = {
  id: string;
  contact_id: string | null;
  profile_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  registered_at: string;
};

type Contact = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
};

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Sub-components

type PageHeaderProps = {
  title: string | null | undefined;
  loading: boolean;
  onAddOpen: () => void;
};

function PageHeader({ title, loading, onAddOpen }: PageHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-petroleum-700 text-3xl">
          {loading ? (
            <span className="bg-sand-100 inline-block h-8 w-64 animate-pulse rounded-lg" />
          ) : (
            title
          )}
        </h1>

        <Button
          variant="solid"
          size="md"
          onClick={() => void onAddOpen()}
          disabled={loading}
          className="gap-2 self-start sm:self-auto"
        >
          <IconPlus />
          Add enrollee
        </Button>
      </div>
    </div>
  );
}

type EnrolleeRowProps = {
  enrollee: Enrollee;
  index: number;
  removeOpen: string | null;
  removingId: string | null;
  onConfirmOpen: (id: string) => void;
  onConfirmClose: () => void;
  onRemove: (id: string) => void;
};

function EnrolleeRow({
  enrollee,
  index,
  removeOpen,
  removingId,
  onConfirmOpen,
  onConfirmClose,
  onRemove,
}: EnrolleeRowProps) {
  return (
    <tr className="border-sand-50 hover:bg-sand-50 border-b transition-colors">
      <td className="text-petroleum-300 px-5 py-4">{index + 1}</td>
      <td className="text-petroleum-700 px-5 py-4 font-medium">
        {enrollee.full_name ?? (
          <span className="text-petroleum-300">{"—"}</span>
        )}
      </td>
      <td className="text-petroleum-500 px-5 py-4">
        {enrollee.email ?? <span className="text-petroleum-300">{"—"}</span>}
      </td>
      <td className="text-petroleum-500 px-5 py-4">
        {enrollee.phone ?? <span className="text-petroleum-300">{"—"}</span>}
      </td>
      <td className="text-petroleum-400 px-5 py-4">
        {formatDateTime(enrollee.registered_at)}
      </td>
      <td className="px-5 py-4">
        {removeOpen === enrollee.id ? (
          <div className="flex items-center gap-1.5">
            <span className="text-petroleum-400 text-xs">Remove?</span>
            <button
              onClick={() => onRemove(enrollee.id)}
              disabled={removingId === enrollee.id}
              className="inline-flex items-center rounded-xl bg-red-500 px-3 py-1.5 text-xs text-white transition-colors hover:bg-red-600 disabled:opacity-50"
            >
              {removingId === enrollee.id ? "…" : "Yes"}
            </button>
            <button
              onClick={onConfirmClose}
              disabled={removingId === enrollee.id}
              className="border-sand-200 text-petroleum-400 hover:bg-sand-50 inline-flex items-center rounded-xl border px-3 py-1.5 text-xs transition-colors disabled:opacity-50"
            >
              Keep enrollment
            </button>
          </div>
        ) : (
          <button
            onClick={() => onConfirmOpen(enrollee.id)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 px-3 py-1.5 text-xs text-red-500 transition-colors hover:bg-red-50"
          >
            <IconTrash />
            Remove
          </button>
        )}
      </td>
    </tr>
  );
}

type AddEnrolleeModalProps = {
  search: string;
  contactsLoading: boolean;
  filteredContacts: Contact[];
  addingId: string | null;
  onClose: () => void;
  onSearch: (value: string) => void;
  onAdd: (contact: Contact) => void;
};

function AddEnrolleeModal({
  search,
  contactsLoading,
  filteredContacts,
  addingId,
  onClose,
  onSearch,
  onAdd,
}: AddEnrolleeModalProps) {
  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        role="presentation"
        className="mx-4 flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between px-6 pt-6 pb-4">
          <h2 className="font-display text-petroleum-700 text-xl">
            Add Enrollee
          </h2>
          <button
            onClick={onClose}
            className="text-petroleum-400 hover:bg-sand-100 hover:text-petroleum-700 rounded-lg p-1.5 transition-colors"
          >
            <IconX />
          </button>
        </div>

        <div className="shrink-0 px-6 pb-3">
          <div className="relative">
            <span className="text-petroleum-300 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
              <IconSearch />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search by name, email or phone…"
              className="border-sand-200 bg-sand-50 text-petroleum-700 placeholder:text-petroleum-300 focus:border-petroleum-400 focus:ring-petroleum-100 w-full rounded-xl border py-2.5 pr-4 pl-9 text-sm outline-none focus:ring-2"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {contactsLoading ? (
            <div className="space-y-2 pt-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-sand-100 h-14 animate-pulse rounded-xl"
                />
              ))}
            </div>
          ) : filteredContacts.length === 0 ? (
            <p className="text-petroleum-400 py-8 text-center text-sm">
              {search
                ? "No contacts match your search."
                : "All contacts are already enrolled."}
            </p>
          ) : (
            <ul className="space-y-1.5 pt-1">
              {filteredContacts.map((contact) => (
                <li key={contact.id}>
                  <div className="border-sand-100 hover:border-petroleum-200 hover:bg-sand-50 flex w-full items-center justify-between rounded-xl border px-4 py-3 transition-colors">
                    <div>
                      <p className="text-petroleum-700 text-sm font-medium">
                        {contact.full_name}
                      </p>
                      <p className="text-petroleum-400 mt-0.5 text-xs">
                        {[contact.email, contact.phone]
                          .filter(Boolean)
                          .join(" · ") || "No contact info"}
                      </p>
                    </div>
                    <Button
                      variant="solid"
                      size="sm"
                      onClick={() => onAdd(contact)}
                      disabled={addingId === contact.id}
                      className="shrink-0 gap-1.5"
                    >
                      {addingId === contact.id ? (
                        <IconSpinner className="animate-spin" />
                      ) : (
                        <IconPlus />
                      )}
                      Add enrollee
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EnrolleesPage() {
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
    async function load() {
      dispatch({ type: "LOAD_START" });

      const { data: sessionData } = await insforge.database
        .from("education_sessions")
        .select("id, title, date, max_participants")
        .eq("id", id)
        .limit(1);

      const sessionRow = (sessionData as Session[] | null)?.[0];
      if (!sessionRow) {
        dispatch({ type: "NOT_FOUND" });
        return;
      }

      await loadEnrollees();

      dispatch({ type: "LOAD_SUCCESS", session: sessionRow });
    }

    void load();
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

    const registeredContactIds = enrollees.flatMap((e) =>
      e.contact_id ? [e.contact_id] : [],
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
        registeredContactIds.includes(c.id)
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
      (c.phone ?? "").includes(q)
    );
  });

  if (notFound) {
    return (
      <div className="text-petroleum-400 flex flex-col items-center justify-center py-24">
        <p className="text-sm">Session not found.</p>
        <button
          onClick={() => back()}
          className="hover:text-petroleum-700 mt-4 text-xs underline"
        >
          Go back
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
              {formatDate(session.date)}
            </p>
            <p className="text-petroleum-400 text-sm">
              {enrollees.length} enrollee{enrollees.length !== 1 ? "s" : ""}
              {session.max_participants != null && (
                <span
                  className={
                    enrollees.length >= session.max_participants
                      ? "font-medium text-red-500"
                      : ""
                  }
                >
                  {" "}
                  / {session.max_participants} max
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
                  Name
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Email
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Phone
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Enrolled at
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
                    No enrollees yet.
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
