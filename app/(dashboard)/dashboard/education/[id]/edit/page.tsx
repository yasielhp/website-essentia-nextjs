"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
};

const INPUT_CLASS =
  "border-sand-200 bg-white text-petroleum-700 placeholder:text-petroleum-300 focus:border-petroleum-400 focus:ring-petroleum-100 rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 w-full disabled:opacity-60";

const TEXTAREA_CLASS =
  "border-sand-200 bg-white text-petroleum-700 placeholder:text-petroleum-300 focus:border-petroleum-400 focus:ring-petroleum-100 rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 w-full resize-none min-h-[80px] disabled:opacity-60";

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

function IconUsers() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path
        d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
        stroke="currentColor"
        strokeWidth="1.5"
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

function IconSpinner() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="31.4 31.4"
      />
    </svg>
  );
}

export default function EditSessionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("");
  const [location, setLocation] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [access, setAccess] = useState<AccessType>("members_only");

  useEffect(() => {
    async function load() {
      const { data } = await insforge.database
        .from("education_sessions")
        .select(
          "id, title, description, date, duration_minutes, location, max_participants, image_url, access",
        )
        .eq("id", id)
        .limit(1);

      const row = (data as Session[] | null)?.[0];
      if (!row) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const dt = new Date(row.date);
      const dateStr = dt.toISOString().split("T")[0];
      const timeStr = dt.toTimeString().slice(0, 5);

      setTitle(row.title);
      setDescription(row.description ?? "");
      setDate(dateStr);
      setTime(timeStr);
      setDuration(
        row.duration_minutes != null ? String(row.duration_minutes) : "",
      );
      setLocation(row.location ?? "");
      setMaxParticipants(
        row.max_participants != null ? String(row.max_participants) : "",
      );
      setImageUrl(row.image_url ?? "");
      setAccess(row.access ?? "members_only");
      setLoading(false);
    }

    void load();
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle || !date || !time) {
      setError("Title, date and time are required.");
      return;
    }

    setSaving(true);

    const isoDateTime = new Date(date + "T" + time).toISOString();

    const { error: updateError } = await insforge.database
      .from("education_sessions")
      .update({
        title: trimmedTitle,
        description: description.trim() || null,
        date: isoDateTime,
        duration_minutes: parseInt(duration) || null,
        location: location.trim() || null,
        max_participants: parseInt(maxParticipants) || null,
        image_url: imageUrl || null,
        access,
      })
      .eq("id", id);

    setSaving(false);

    if (updateError) {
      setError(
        (updateError as { message?: string })?.message ?? "Failed to save.",
      );
      return;
    }

    router.push("/dashboard/education");
  }

  async function handleDelete() {
    setDeleting(true);
    await insforge.database
      .from("education_registrations")
      .delete()
      .eq("session_id", id);
    await insforge.database.from("education_sessions").delete().eq("id", id);
    router.push("/dashboard/education");
  }

  if (notFound) {
    return (
      <div className="text-petroleum-400 flex flex-col items-center justify-center py-24">
        <p className="text-sm">Session not found.</p>
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
      <button
        onClick={() => router.back()}
        className="text-petroleum-400 hover:text-petroleum-700 mb-6 inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <IconArrowLeft />
        Back to Education
      </button>

      <form onSubmit={(e) => void handleSave(e)} noValidate>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-petroleum-700 text-3xl">
              {loading ? (
                <span className="bg-sand-100 inline-block h-8 w-56 animate-pulse rounded-lg" />
              ) : (
                title || "Edit Session"
              )}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="md"
              href={`/dashboard/education/${id}/enrollees`}
              className="gap-1.5"
            >
              <IconUsers />
              Enrollees
            </Button>

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
              {saving ? <IconSpinner /> : <IconCheck />}
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

        {error && (
          <p className="mb-6 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <div className="border-sand-200 rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
                Details
              </h2>
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-petroleum-500 text-xs font-medium">
                    Title <span className="text-red-400">*</span>
                  </label>
                  {loading ? (
                    <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                  ) : (
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      disabled={saving}
                      className={INPUT_CLASS}
                    />
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-petroleum-500 text-xs font-medium">
                    Description
                  </label>
                  {loading ? (
                    <div className="bg-sand-100 h-20 animate-pulse rounded-xl" />
                  ) : (
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={saving}
                      className={TEXTAREA_CLASS}
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-petroleum-500 text-xs font-medium">
                      Date <span className="text-red-400">*</span>
                    </label>
                    {loading ? (
                      <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                    ) : (
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        disabled={saving}
                        className={INPUT_CLASS}
                      />
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-petroleum-500 text-xs font-medium">
                      Time <span className="text-red-400">*</span>
                    </label>
                    {loading ? (
                      <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                    ) : (
                      <input
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        disabled={saving}
                        className={INPUT_CLASS}
                      />
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-petroleum-500 text-xs font-medium">
                    Location
                  </label>
                  {loading ? (
                    <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                  ) : (
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Studio A"
                      disabled={saving}
                      className={INPUT_CLASS}
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-petroleum-500 text-xs font-medium">
                      Duration
                    </label>
                    {loading ? (
                      <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                    ) : (
                      <div className="relative">
                        <input
                          type="number"
                          value={duration}
                          onChange={(e) => setDuration(e.target.value)}
                          placeholder="60"
                          min="1"
                          disabled={saving}
                          className={INPUT_CLASS + " pr-12"}
                        />
                        <span className="text-petroleum-400 pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm">
                          min
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-petroleum-500 text-xs font-medium">
                      Max participants
                    </label>
                    {loading ? (
                      <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                    ) : (
                      <input
                        type="number"
                        value={maxParticipants}
                        onChange={(e) => setMaxParticipants(e.target.value)}
                        placeholder="20"
                        min="1"
                        disabled={saving}
                        className={INPUT_CLASS}
                      />
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-petroleum-500 text-xs font-medium">
                    Access
                  </label>
                  {loading ? (
                    <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                  ) : (
                    <select
                      value={access}
                      onChange={(e) => setAccess(e.target.value as AccessType)}
                      disabled={saving}
                      className={INPUT_CLASS}
                    >
                      <option value="members_only">Members only</option>
                      <option value="open">Open · free for everyone</option>
                      <option value="paid">Paid</option>
                      <option value="paid_members_free">
                        Paid · free for members
                      </option>
                    </select>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="border-sand-200 rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
                Cover Image
              </h2>
              {loading ? (
                <div className="bg-sand-100 h-36 animate-pulse rounded-xl" />
              ) : (
                <ImageUpload
                  bucket="events"
                  folder="education"
                  value={imageUrl}
                  onChange={setImageUrl}
                />
              )}
            </div>
          </div>
        </div>
      </form>

      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex flex-col gap-1">
              <h3 className="font-display text-petroleum-700 text-xl">
                Delete session?
              </h3>
              <p className="text-petroleum-400 text-sm">
                <strong className="text-petroleum-600 font-medium">
                  {title}
                </strong>{" "}
                will be permanently deleted along with all its enrollments.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="danger"
                size="md"
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="w-full"
              >
                {deleting ? "Deleting…" : "Yes, delete"}
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() => setDeleteOpen(false)}
                disabled={deleting}
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
