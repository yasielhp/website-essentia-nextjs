"use client";

import { useEffect, useState, useCallback } from "react";
import { insforge } from "@/lib/insforge";

type Contact = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  user_id: string | null;
  created_at: string | null;
};

type LastBooking = {
  contact_id: string;
  created_at: string | null;
  status: string | null;
};

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

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [lastBookings, setLastBookings] = useState<Map<string, LastBooking>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const { data: contactData, count } = await insforge.database
      .from("contacts")
      .select("id, email, first_name, last_name, phone, user_id, created_at", {
        count: "exact",
      })
      .order("created_at", { ascending: false });

    const contacts = (contactData as Contact[] | null) ?? [];
    setContacts(contacts);
    setTotal(count ?? 0);

    if (contacts.length > 0) {
      const ids = contacts.map((c) => c.id);
      const { data: bookingData } = await insforge.database
        .from("bookings")
        .select("contact_id, created_at, status")
        .in("contact_id", ids)
        .order("created_at", { ascending: false });

      const map = new Map<string, LastBooking>();
      for (const b of (bookingData as LastBooking[] | null) ?? []) {
        if (!map.has(b.contact_id)) {
          map.set(b.contact_id, b);
        }
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
      <div className="mb-8">
        <h1 className="font-display text-petroleum-700 text-3xl">Contacts</h1>
        <p className="text-petroleum-400 mt-1 text-sm">
          {total} contact{total !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="border-sand-200 overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full min-w-[800px] text-sm">
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
                Status
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
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="bg-sand-100 h-4 animate-pulse rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : contacts.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="text-petroleum-400 px-6 py-12 text-center"
                >
                  No contacts yet.
                </td>
              </tr>
            ) : (
              contacts.map((c) => {
                const last = lastBookings.get(c.id);
                return (
                  <tr
                    key={c.id}
                    className="border-sand-50 hover:bg-sand-50 border-b transition-colors"
                  >
                    <td className="text-petroleum-700 px-5 py-4 font-medium">
                      {[c.first_name, c.last_name].filter(Boolean).join(" ") ||
                        "—"}
                    </td>
                    <td className="text-petroleum-400 px-5 py-4">
                      {c.email ?? "—"}
                    </td>
                    <td className="text-petroleum-400 px-5 py-4">
                      {c.phone ?? "—"}
                    </td>
                    <td className="text-petroleum-500 px-5 py-4">
                      {last ? formatDate(last.created_at) : "—"}
                    </td>
                    <td className="px-5 py-4">
                      {last ? (
                        <StatusBadge status={last.status} />
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
