"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";

const INPUT_CLASS =
  "border-sand-200 bg-white text-petroleum-700 placeholder:text-petroleum-300 focus:border-petroleum-400 focus:ring-petroleum-100 rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 w-full disabled:opacity-60";

function IconCheck() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path
        d="M20 6L9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
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

type Contact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
};

type Booking = {
  id: string;
  service_title: string | null;
  date: string | null;
  time: string | null;
  status: string | null;
  created_at: string | null;
};

type RaceReg = {
  id: string;
  created_at: string | null;
  race_id: string;
  race: {
    title: string | null;
    date: string | null;
    location: string | null;
  } | null;
};

type EduReg = {
  id: string;
  created_at: string | null;
  session_id: string;
  session: {
    title: string | null;
    date: string | null;
    location: string | null;
  } | null;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700",
  confirmed: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-600",
};

function StatusBadge({ status }: { status: string | null }) {
  const s = status ?? "unknown";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[s] ?? "bg-sand-100 text-petroleum-500"}`}
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

function DeleteDialog({
  name,
  deleting,
  onConfirm,
  onCancel,
}: {
  name: string;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-petroleum-700 text-xl">
            Delete contact?
          </h3>
          <p className="text-petroleum-400 text-sm">
            <strong className="text-petroleum-600 font-medium">{name}</strong>{" "}
            and all their associated bookings and registrations will be
            permanently deleted.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            variant="danger"
            size="md"
            onClick={onConfirm}
            disabled={deleting}
            className="w-full"
          >
            {deleting ? "Deleting…" : "Yes, delete"}
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={onCancel}
            disabled={deleting}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { push, back } = useRouter();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [raceRegs, setRaceRegs] = useState<RaceReg[]>([]);
  const [eduRegs, setEduRegs] = useState<EduReg[]>([]);

  useEffect(() => {
    async function load() {
      const [
        { data: contacts },
        { data: bookingData },
        { data: raceRegData },
        { data: eduRegData },
      ] = await Promise.all([
        insforge.database
          .from("contacts")
          .select("id, first_name, last_name, email, phone")
          .eq("id", id)
          .limit(1),
        insforge.database
          .from("bookings")
          .select("id, service_title, date, time, status, created_at")
          .eq("contact_id", id)
          .order("created_at", { ascending: false }),
        insforge.database
          .from("race_registrations")
          .select("id, created_at, race_id")
          .eq("contact_id", id)
          .order("created_at", { ascending: false }),
        insforge.database
          .from("education_registrations")
          .select("id, created_at, session_id")
          .eq("contact_id", id)
          .order("created_at", { ascending: false }),
      ]);

      const contact = (contacts as Contact[] | null)?.[0];
      if (!contact) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setFirstName(contact.first_name ?? "");
      setLastName(contact.last_name ?? "");
      setEmail(contact.email ?? "");
      setPhone(contact.phone ?? "");
      setBookings((bookingData as Booking[] | null) ?? []);

      const raceRows =
        (raceRegData as
          | { id: string; created_at: string | null; race_id: string }[]
          | null) ?? [];
      const eduRows =
        (eduRegData as
          | { id: string; created_at: string | null; session_id: string }[]
          | null) ?? [];

      // Fetch race and session details
      const raceIds = raceRows.map((r) => r.race_id);
      const sessionIds = eduRows.map((r) => r.session_id);

      const [{ data: racesData }, { data: sessionsData }] = await Promise.all([
        raceIds.length > 0
          ? insforge.database
              .from("races")
              .select("id, title, date, location")
              .in("id", raceIds)
          : Promise.resolve({ data: [] }),
        sessionIds.length > 0
          ? insforge.database
              .from("education_sessions")
              .select("id, title, date, location")
              .in("id", sessionIds)
          : Promise.resolve({ data: [] }),
      ]);

      const racesMap = new Map(
        (
          (racesData as {
            id: string;
            title: string | null;
            date: string | null;
            location: string | null;
          }[]) ?? []
        ).map((r) => [r.id, r]),
      );
      const sessionsMap = new Map(
        (
          (sessionsData as {
            id: string;
            title: string | null;
            date: string | null;
            location: string | null;
          }[]) ?? []
        ).map((s) => [s.id, s]),
      );

      setRaceRegs(
        raceRows.map((r) => ({
          ...r,
          race: racesMap.get(r.race_id) ?? null,
        })),
      );
      setEduRegs(
        eduRows.map((r) => ({
          ...r,
          session: sessionsMap.get(r.session_id) ?? null,
        })),
      );

      setLoading(false);
    }

    void load();
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedFirst = firstName.trim();
    if (!trimmedFirst) {
      setError("First name is required.");
      return;
    }

    setSaving(true);

    const { error: updateError } = await insforge.database
      .from("contacts")
      .update({
        first_name: trimmedFirst,
        last_name: lastName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
      })
      .eq("id", id);

    setSaving(false);

    if (updateError) {
      setError(
        (updateError as { message?: string })?.message ??
          "Failed to save contact.",
      );
      return;
    }

    push("/dashboard/contacts");
  }

  async function handleDelete() {
    setDeleting(true);
    await Promise.all([
      insforge.database
        .from("race_registrations")
        .delete()
        .eq("contact_id", id),
      insforge.database
        .from("education_registrations")
        .delete()
        .eq("contact_id", id),
      insforge.database.from("bookings").delete().eq("contact_id", id),
    ]);
    await insforge.database.from("contacts").delete().eq("id", id);
    push("/dashboard/contacts");
  }

  const displayName =
    [firstName, lastName].filter(Boolean).join(" ") || "Contact";

  if (notFound) {
    return (
      <div className="text-petroleum-400 flex flex-col items-center justify-center py-24">
        <p className="text-sm">Contact not found.</p>
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
      <form onSubmit={(e) => void handleSave(e)} noValidate>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-petroleum-700 text-3xl">
            Edit Contact
          </h1>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline-danger"
              size="md"
              onClick={() => setDeleteOpen(true)}
              disabled={loading}
              className="gap-1.5"
            >
              <IconTrash />
              Delete
            </Button>
            <Button
              type="submit"
              variant="solid"
              size="md"
              disabled={saving || loading}
              className="gap-1.5"
            >
              <IconCheck />
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

        {error && (
          <p className="mb-6 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="border-sand-200 mb-6 rounded-2xl border bg-white p-6">
          <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
            Details
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="firstName"
                  className="text-petroleum-500 text-xs font-medium"
                >
                  First name <span className="text-red-400">*</span>
                </label>
                {loading ? (
                  <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                ) : (
                  <input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jane"
                    disabled={saving}
                    className={INPUT_CLASS}
                  />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="lastName"
                  className="text-petroleum-500 text-xs font-medium"
                >
                  Last name
                </label>
                {loading ? (
                  <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                ) : (
                  <input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    disabled={saving}
                    className={INPUT_CLASS}
                  />
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="text-petroleum-500 text-xs font-medium"
              >
                Email
              </label>
              {loading ? (
                <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
              ) : (
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                  disabled={saving}
                  className={INPUT_CLASS}
                />
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="phone"
                className="text-petroleum-500 text-xs font-medium"
              >
                Phone
              </label>
              {loading ? (
                <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
              ) : (
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+34 600 000 000"
                  disabled={saving}
                  className={INPUT_CLASS}
                />
              )}
            </div>
          </div>
        </div>
      </form>

      {/* Activity sections */}
      <div className="space-y-5">
        {/* Bookings */}
        <div className="border-sand-200 rounded-2xl border bg-white p-6">
          <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
            Bookings
          </h2>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-sand-100 h-10 animate-pulse rounded-xl"
                />
              ))}
            </div>
          ) : bookings.length === 0 ? (
            <p className="text-petroleum-300 text-sm">No bookings yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-sand-100 border-b text-left">
                    <th className="text-petroleum-400 pr-4 pb-2.5 font-medium">
                      Service
                    </th>
                    <th className="text-petroleum-400 pr-4 pb-2.5 font-medium">
                      Date
                    </th>
                    <th className="text-petroleum-400 pr-4 pb-2.5 font-medium">
                      Time
                    </th>
                    <th className="text-petroleum-400 pb-2.5 font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr
                      key={b.id}
                      className="border-sand-50 border-b last:border-0"
                    >
                      <td className="text-petroleum-700 py-3 pr-4 font-medium">
                        {b.service_title ?? "—"}
                      </td>
                      <td className="text-petroleum-500 py-3 pr-4">
                        {formatDate(b.date)}
                      </td>
                      <td className="text-petroleum-500 py-3 pr-4">
                        {b.time ?? "—"}
                      </td>
                      <td className="py-3">
                        <StatusBadge status={b.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Race registrations */}
        <div className="border-sand-200 rounded-2xl border bg-white p-6">
          <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
            Race registrations
          </h2>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-sand-100 h-10 animate-pulse rounded-xl"
                />
              ))}
            </div>
          ) : raceRegs.length === 0 ? (
            <p className="text-petroleum-300 text-sm">
              No race registrations yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-sand-100 border-b text-left">
                    <th className="text-petroleum-400 pr-4 pb-2.5 font-medium">
                      Race
                    </th>
                    <th className="text-petroleum-400 pr-4 pb-2.5 font-medium">
                      Date
                    </th>
                    <th className="text-petroleum-400 pr-4 pb-2.5 font-medium">
                      Location
                    </th>
                    <th className="text-petroleum-400 pb-2.5 font-medium">
                      Registered
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {raceRegs.map((r) => (
                    <tr
                      key={r.id}
                      className="border-sand-50 border-b last:border-0"
                    >
                      <td className="text-petroleum-700 py-3 pr-4 font-medium">
                        {r.race?.title ?? "—"}
                      </td>
                      <td className="text-petroleum-500 py-3 pr-4">
                        {r.race?.date ? formatDate(r.race.date) : "—"}
                      </td>
                      <td className="text-petroleum-500 py-3 pr-4">
                        {r.race?.location ?? "—"}
                      </td>
                      <td className="text-petroleum-400 py-3">
                        {formatDate(r.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Education sessions */}
        <div className="border-sand-200 rounded-2xl border bg-white p-6">
          <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
            Education sessions
          </h2>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-sand-100 h-10 animate-pulse rounded-xl"
                />
              ))}
            </div>
          ) : eduRegs.length === 0 ? (
            <p className="text-petroleum-300 text-sm">
              No education session registrations yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-sand-100 border-b text-left">
                    <th className="text-petroleum-400 pr-4 pb-2.5 font-medium">
                      Session
                    </th>
                    <th className="text-petroleum-400 pr-4 pb-2.5 font-medium">
                      Date
                    </th>
                    <th className="text-petroleum-400 pr-4 pb-2.5 font-medium">
                      Location
                    </th>
                    <th className="text-petroleum-400 pb-2.5 font-medium">
                      Registered
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {eduRegs.map((r) => (
                    <tr
                      key={r.id}
                      className="border-sand-50 border-b last:border-0"
                    >
                      <td className="text-petroleum-700 py-3 pr-4 font-medium">
                        {r.session?.title ?? "—"}
                      </td>
                      <td className="text-petroleum-500 py-3 pr-4">
                        {r.session?.date ? formatDate(r.session.date) : "—"}
                      </td>
                      <td className="text-petroleum-500 py-3 pr-4">
                        {r.session?.location ?? "—"}
                      </td>
                      <td className="text-petroleum-400 py-3">
                        {formatDate(r.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {deleteOpen && (
        <DeleteDialog
          name={displayName}
          deleting={deleting}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleteOpen(false)}
        />
      )}
    </div>
  );
}
