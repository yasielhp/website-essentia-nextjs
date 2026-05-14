"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/image-upload";

type AccessType = "members_only" | "open" | "paid" | "paid_members_free";

type Session = {
  id: string;
  title: string;
  description: string | null;
  date: string;
  duration_minutes: number | null;
  location: string | null;
  max_participants: number | null;
  image_url: string | null;
  access: AccessType;
  registrations_count: number;
};

const ACCESS_LABELS: Record<AccessType, string> = {
  members_only: "Members only",
  open: "Open · free",
  paid: "Paid",
  paid_members_free: "Paid · free for members",
};

const ACCESS_COLORS: Record<AccessType, string> = {
  members_only: "bg-petroleum-50 text-petroleum-600",
  open: "bg-green-50 text-green-700",
  paid: "bg-amber-50 text-amber-700",
  paid_members_free: "bg-blue-50 text-blue-700",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function IconPlus() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconClose() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

const INPUT_CLASS =
  "border-sand-200 bg-white text-petroleum-700 placeholder:text-petroleum-100 focus:border-petroleum-400 focus:ring-petroleum-100 rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 w-full disabled:opacity-60";

const TEXTAREA_CLASS =
  "border-sand-200 bg-white text-petroleum-700 placeholder:text-petroleum-100 focus:border-petroleum-400 focus:ring-petroleum-100 rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 w-full resize-none min-h-[80px] disabled:opacity-60";

export default function EducationPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formTime, setFormTime] = useState("");
  const [formDuration, setFormDuration] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formMax, setFormMax] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formAccess, setFormAccess] = useState<AccessType>("members_only");

  const router = useRouter();

  const fetchSessions = useCallback(async () => {
    setLoading(true);

    const { data: rows } = await insforge.database
      .from("education_sessions")
      .select(
        "id, title, description, date, duration_minutes, location, max_participants, image_url, access",
      )
      .order("date", { ascending: false });

    if (!rows || (rows as unknown[]).length === 0) {
      setSessions([]);
      setLoading(false);
      return;
    }

    const sessionList = rows as Omit<Session, "registrations_count">[];
    const ids = sessionList.map((s) => s.id);

    const { data: regs } = await insforge.database
      .from("education_registrations")
      .select("session_id")
      .in("session_id", ids);

    const countMap: Record<string, number> = {};
    if (regs) {
      for (const r of regs as { session_id: string }[]) {
        countMap[r.session_id] = (countMap[r.session_id] ?? 0) + 1;
      }
    }

    setSessions(
      sessionList.map((s) => ({
        ...s,
        registrations_count: countMap[s.id] ?? 0,
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchSessions();
  }, [fetchSessions]);

  function openCreate() {
    setFormTitle("");
    setFormDescription("");
    setFormDate("");
    setFormTime("");
    setFormDuration("");
    setFormLocation("");
    setFormMax("");
    setFormImageUrl("");
    setFormAccess("members_only");
    setFormError(null);
    setCreateOpen(true);
  }

  function closeCreate() {
    if (submitting) return;
    setCreateOpen(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const title = formTitle.trim();
    if (!title || !formDate || !formTime) {
      setFormError("Title, date and time are required.");
      return;
    }

    setSubmitting(true);

    const isoDateTime = new Date(formDate + "T" + formTime).toISOString();

    const { error } = await insforge.database
      .from("education_sessions")
      .insert([
        {
          title,
          description: formDescription.trim() || null,
          date: isoDateTime,
          duration_minutes: parseInt(formDuration) || null,
          location: formLocation.trim() || null,
          max_participants: parseInt(formMax) || null,
          image_url: formImageUrl || null,
          access: formAccess,
        },
      ]);

    setSubmitting(false);

    if (error) {
      setFormError(
        (error as { message?: string }).message ?? "Failed to create session.",
      );
      return;
    }

    setCreateOpen(false);
    void fetchSessions();
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-petroleum-700 text-3xl">
            Education
          </h1>
        </div>

        <Button
          variant="solid"
          size="md"
          onClick={openCreate}
          className="gap-2 self-start"
        >
          <IconPlus />
          Create Session
        </Button>
      </div>

      <div className="border-sand-200 rounded-2xl border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-sand-200 border-b text-left">
                <th className="text-petroleum-400 w-14 px-5 py-3.5 font-medium"></th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Title
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Access
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Date
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Time
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Duration
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Location
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Enrolled / Max
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-sand-50 border-b">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="bg-sand-100 h-4 animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : sessions.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="text-petroleum-400 px-6 py-12 text-center"
                  >
                    No sessions yet.
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr
                    key={session.id}
                    onClick={() =>
                      router.push(`/dashboard/education/${session.id}/edit`)
                    }
                    className="border-sand-50 hover:bg-sand-50 cursor-pointer border-b transition-colors"
                  >
                    <td className="px-5 py-3">
                      {session.image_url ? (
                        <div className="bg-sand-100 relative h-10 w-10 overflow-hidden rounded-lg">
                          <Image
                            src={session.image_url}
                            alt={session.title}
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="bg-sand-100 flex h-10 w-10 items-center justify-center rounded-lg">
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            className="text-petroleum-300"
                          >
                            <rect
                              x="3"
                              y="3"
                              width="18"
                              height="18"
                              rx="2"
                              stroke="currentColor"
                              strokeWidth="1.5"
                            />
                            <circle
                              cx="8.5"
                              cy="8.5"
                              r="1.5"
                              stroke="currentColor"
                              strokeWidth="1.5"
                            />
                            <path
                              d="M21 15l-5-5L5 21"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      )}
                    </td>
                    <td className="text-petroleum-700 px-5 py-4 font-medium">
                      {session.title}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ACCESS_COLORS[session.access]}`}
                      >
                        {ACCESS_LABELS[session.access]}
                      </span>
                    </td>
                    <td className="text-petroleum-500 px-5 py-4">
                      {formatDate(session.date)}
                    </td>
                    <td className="text-petroleum-500 px-5 py-4">
                      {formatTime(session.date)}
                    </td>
                    <td className="text-petroleum-400 px-5 py-4">
                      {session.duration_minutes != null
                        ? `${session.duration_minutes} min`
                        : "—"}
                    </td>
                    <td className="text-petroleum-400 px-5 py-4">
                      {session.location ?? "—"}
                    </td>
                    <td className="text-petroleum-500 px-5 py-4">
                      {session.registrations_count}
                      {session.max_participants != null
                        ? ` / ${session.max_participants}`
                        : " / —"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create session modal */}
      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={closeCreate}
        >
          <div
            className="mx-4 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-petroleum-700 text-xl">
                Create Session
              </h2>
              <button
                onClick={closeCreate}
                disabled={submitting}
                className="text-petroleum-400 hover:bg-sand-100 hover:text-petroleum-700 rounded-lg p-1.5 transition-colors disabled:opacity-50"
                aria-label="Close"
              >
                <IconClose />
              </button>
            </div>

            <form onSubmit={(e) => void handleCreate(e)} noValidate>
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-petroleum-500 text-xs font-medium">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Introduction to Breathwork"
                    disabled={submitting}
                    className={INPUT_CLASS}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-petroleum-500 text-xs font-medium">
                    Description
                  </label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="A brief overview of the session…"
                    disabled={submitting}
                    className={TEXTAREA_CLASS}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-petroleum-500 text-xs font-medium">
                      Date *
                    </label>
                    <input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      disabled={submitting}
                      className={INPUT_CLASS}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-petroleum-500 text-xs font-medium">
                      Time *
                    </label>
                    <input
                      type="time"
                      value={formTime}
                      onChange={(e) => setFormTime(e.target.value)}
                      disabled={submitting}
                      className={INPUT_CLASS}
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-petroleum-500 text-xs font-medium">
                    Location
                  </label>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="Studio A"
                    disabled={submitting}
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-petroleum-500 text-xs font-medium">
                      Duration
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={formDuration}
                        onChange={(e) => setFormDuration(e.target.value)}
                        placeholder="60"
                        min="1"
                        disabled={submitting}
                        className={INPUT_CLASS + " pr-12"}
                      />
                      <span className="text-petroleum-400 pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm">
                        min
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-petroleum-500 text-xs font-medium">
                      Max participants
                    </label>
                    <input
                      type="number"
                      value={formMax}
                      onChange={(e) => setFormMax(e.target.value)}
                      placeholder="20"
                      min="1"
                      disabled={submitting}
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-petroleum-500 text-xs font-medium">
                    Access
                  </label>
                  <select
                    value={formAccess}
                    onChange={(e) =>
                      setFormAccess(e.target.value as AccessType)
                    }
                    disabled={submitting}
                    className={INPUT_CLASS}
                  >
                    <option value="members_only">Members only</option>
                    <option value="open">Open · free for everyone</option>
                    <option value="paid">Paid</option>
                    <option value="paid_members_free">
                      Paid · free for members
                    </option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-petroleum-500 text-xs font-medium">
                    Cover Image
                  </label>
                  <ImageUpload
                    bucket="events"
                    folder="education"
                    value={formImageUrl}
                    onChange={setFormImageUrl}
                  />
                </div>
              </div>

              {formError && (
                <p className="mt-4 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
                  {formError}
                </p>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  onClick={closeCreate}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="solid"
                  size="md"
                  disabled={submitting}
                >
                  {submitting ? "Creating…" : "Create Session"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
