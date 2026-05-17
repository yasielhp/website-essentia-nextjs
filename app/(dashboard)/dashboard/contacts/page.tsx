"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";

type Contact = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  created_at: string | null;
};

type LastBooking = {
  contact_id: string;
  created_at: string | null;
};

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

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [lastBookings, setLastBookings] = useState<Map<string, LastBooking>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const { push } = useRouter();

  const fetchData = useCallback(async () => {
    setLoading(true);

    const { data: contactData } = await insforge.database
      .from("contacts")
      .select("id, email, first_name, last_name, phone, created_at")
      .order("created_at", { ascending: false });

    const list = (contactData as Contact[] | null) ?? [];
    setContacts(list);

    if (list.length > 0) {
      const ids = list.map((c) => c.id);
      const { data: bookingData } = await insforge.database
        .from("bookings")
        .select("contact_id, created_at")
        .in("contact_id", ids)
        .order("created_at", { ascending: false });

      const map = new Map<string, LastBooking>();
      for (const b of (bookingData as LastBooking[] | null) ?? []) {
        if (!map.has(b.contact_id)) map.set(b.contact_id, b);
      }
      setLastBookings(map);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
  }, [fetchData]);

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-petroleum-700 text-3xl">Contacts</h1>
        <Button
          variant="solid"
          size="md"
          href="/dashboard/contacts/new"
          className="gap-2 self-start"
        >
          <IconPlus />
          Add Contact
        </Button>
      </div>

      <div className="border-sand-200 overflow-x-auto rounded-2xl border bg-white">
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
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-sand-50 border-b">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="bg-sand-100 h-4 animate-pulse rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : contacts.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="text-petroleum-400 px-6 py-12 text-center"
                >
                  No contacts yet.
                </td>
              </tr>
            ) : (
              contacts.map((c) => {
                const last = lastBookings.get(c.id);
                const displayName =
                  [c.first_name, c.last_name].filter(Boolean).join(" ") || "—";
                return (
                  <tr
                    key={c.id}
                    onClick={() => push(`/dashboard/contacts/${c.id}`)}
                    className="border-sand-50 hover:bg-sand-50 cursor-pointer border-b transition-colors"
                  >
                    <td className="text-petroleum-700 px-5 py-4 font-medium">
                      {displayName}
                    </td>
                    <td className="text-petroleum-400 px-5 py-4">
                      {c.email ?? (
                        <span className="text-petroleum-200">{"—"}</span>
                      )}
                    </td>
                    <td className="text-petroleum-400 px-5 py-4">
                      {c.phone ?? (
                        <span className="text-petroleum-200">{"—"}</span>
                      )}
                    </td>
                    <td className="text-petroleum-400 px-5 py-4">
                      {last ? (
                        formatDate(last.created_at)
                      ) : (
                        <span className="text-petroleum-200">{"—"}</span>
                      )}
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
    </div>
  );
}
