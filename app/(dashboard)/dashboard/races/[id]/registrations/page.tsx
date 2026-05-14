"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";

type Race = {
  id: string;
  title: string;
  date: string | null;
  max_participants: number | null;
};

type Registration = {
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

function formatDate(iso: string | null): string {
  if (!iso) return "—";
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

function IconArrowLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M19 12H5M5 12l7 7M5 12l7-7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M21 21l-4.35-4.35"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function RaceRegistrationsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [race, setRace] = useState<Race | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);

  const loadRegistrations = useCallback(async () => {
    const { data: regs } = await insforge.database
      .from("race_registrations")
      .select("id, user_id, contact_id, created_at")
      .eq("race_id", id)
      .order("created_at", { ascending: true });

    if (!regs || (regs as unknown[]).length === 0) {
      setRegistrations([]);
      return;
    }

    const regList = regs as {
      id: string;
      user_id: string | null;
      contact_id: string | null;
      created_at: string;
    }[];

    const contactIds = regList
      .map((r) => r.contact_id)
      .filter(Boolean) as string[];
    const userIds = regList.map((r) => r.user_id).filter(Boolean) as string[];

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

    setRegistrations(
      regList.map((r) => {
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
    );
  }, [id]);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data: raceData } = await insforge.database
        .from("races")
        .select("id, title, date, max_participants")
        .eq("id", id)
        .limit(1);

      const raceRow = (raceData as Race[] | null)?.[0];
      if (!raceRow) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setRace(raceRow);
      await loadRegistrations();
      setLoading(false);
    }

    void load();
  }, [id, loadRegistrations]);

  async function handleRemove(regId: string) {
    setRemovingId(regId);
    await insforge.database.from("race_registrations").delete().eq("id", regId);
    setRemovingId(null);
    setConfirmRemoveId(null);
    await loadRegistrations();
  }

  async function openAdd() {
    setSearch("");
    setAddOpen(true);
    setContactsLoading(true);

    const registeredContactIds = registrations
      .map((r) => r.contact_id)
      .filter(Boolean) as string[];

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

    setContacts(
      all
        .filter((c) => !registeredContactIds.includes(c.id))
        .map((c) => ({
          id: c.id,
          full_name:
            [c.first_name, c.last_name].filter(Boolean).join(" ") || "—",
          email: c.email,
          phone: c.phone,
        })),
    );
    setContactsLoading(false);
  }

  async function handleAddContact(contact: Contact) {
    setAddingId(contact.id);
    await insforge.database
      .from("race_registrations")
      .insert([{ race_id: id, contact_id: contact.id }]);
    setAddingId(null);
    setAddOpen(false);
    await loadRegistrations();
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
        <p className="text-sm">Race not found.</p>
        <button
          onClick={() => router.back()}
          className="hover:text-petroleum-700 mt-4 text-xs underline"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="mb-8">
        <button
          onClick={() => router.back()}
          className="text-petroleum-400 hover:text-petroleum-700 mb-4 inline-flex items-center gap-1.5 text-sm transition-colors"
        >
          <IconArrowLeft />
          Back to Races
        </button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-petroleum-700 text-3xl">
            {loading ? (
              <span className="bg-sand-100 inline-block h-8 w-64 animate-pulse rounded-lg" />
            ) : (
              race?.title
            )}
          </h1>

          <Button
            variant="solid"
            size="md"
            onClick={() => void openAdd()}
            disabled={loading}
            className="gap-2 self-start sm:self-auto"
          >
            <IconPlus />
            Add
          </Button>
        </div>
      </div>

      <div className="border-sand-200 rounded-2xl border bg-white">
        {!loading && (
          <div className="border-sand-100 flex items-center justify-between border-b px-5 py-3">
            <p className="text-petroleum-400 text-sm">
              {formatDate(race?.date ?? null)}
            </p>
            <p className="text-petroleum-400 text-sm">
              {registrations.length} registration
              {registrations.length !== 1 ? "s" : ""}
              {race?.max_participants != null && (
                <span
                  className={
                    registrations.length >= race.max_participants
                      ? "font-medium text-red-500"
                      : ""
                  }
                >
                  {" "}
                  / {race.max_participants} max
                </span>
              )}
            </p>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
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
                  Registered at
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
              ) : registrations.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-petroleum-400 px-6 py-12 text-center"
                  >
                    No registrations yet.
                  </td>
                </tr>
              ) : (
                registrations.map((reg, index) => (
                  <tr
                    key={reg.id}
                    className="border-sand-50 hover:bg-sand-50 border-b transition-colors"
                  >
                    <td className="text-petroleum-300 px-5 py-4">
                      {index + 1}
                    </td>
                    <td className="text-petroleum-700 px-5 py-4 font-medium">
                      {reg.full_name ?? (
                        <span className="text-petroleum-300">—</span>
                      )}
                    </td>
                    <td className="text-petroleum-500 px-5 py-4">
                      {reg.email ?? (
                        <span className="text-petroleum-300">—</span>
                      )}
                    </td>
                    <td className="text-petroleum-500 px-5 py-4">
                      {reg.phone ?? (
                        <span className="text-petroleum-300">—</span>
                      )}
                    </td>
                    <td className="text-petroleum-400 px-5 py-4">
                      {formatDateTime(reg.registered_at)}
                    </td>
                    <td className="px-5 py-4">
                      {confirmRemoveId === reg.id ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-petroleum-400 text-xs">
                            Remove?
                          </span>
                          <button
                            onClick={() => void handleRemove(reg.id)}
                            disabled={removingId === reg.id}
                            className="inline-flex items-center rounded-xl bg-red-500 px-3 py-1.5 text-xs text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                          >
                            {removingId === reg.id ? "…" : "Yes"}
                          </button>
                          <button
                            onClick={() => setConfirmRemoveId(null)}
                            disabled={removingId === reg.id}
                            className="border-sand-200 text-petroleum-400 hover:bg-sand-50 inline-flex items-center rounded-xl border px-3 py-1.5 text-xs transition-colors disabled:opacity-50"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmRemoveId(reg.id)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-red-300 px-3 py-1.5 text-xs text-red-500 transition-colors hover:bg-red-50"
                        >
                          <IconTrash />
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {addOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setAddOpen(false)}
        >
          <div
            className="mx-4 flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between px-6 pt-6 pb-4">
              <h2 className="font-display text-petroleum-700 text-xl">
                Add Registration
              </h2>
              <button
                onClick={() => setAddOpen(false)}
                className="text-petroleum-400 hover:bg-sand-100 hover:text-petroleum-700 rounded-lg p-1.5 transition-colors"
              >
                <IconClose />
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
                  onChange={(e) => setSearch(e.target.value)}
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
                    : "All contacts are already registered."}
                </p>
              ) : (
                <ul className="space-y-1.5 pt-1">
                  {filteredContacts.map((contact) => (
                    <li
                      key={contact.id}
                      className="border-sand-100 hover:border-petroleum-200 hover:bg-sand-50 flex items-center justify-between rounded-xl border px-4 py-3 transition-colors"
                    >
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
                        type="button"
                        variant="solid"
                        size="sm"
                        className="shrink-0 gap-1.5"
                        onClick={() => void handleAddContact(contact)}
                        disabled={addingId === contact.id}
                      >
                        {addingId === contact.id ? (
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        ) : (
                          <IconPlus />
                        )}
                        Add
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
