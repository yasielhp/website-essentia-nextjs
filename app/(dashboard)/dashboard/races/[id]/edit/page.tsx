"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/image-upload";

type Race = {
  id: string;
  title: string;
  description: string | null;
  date: string | null;
  location: string | null;
  distance_km: number | null;
  max_participants: number | null;
  image_url: string | null;
  access: "members" | "open";
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
        strokeWidth="2"
        strokeOpacity="0.25"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function EditRacePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("07:00");
  const [location, setLocation] = useState("");
  const [distance, setDistance] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [access, setAccess] = useState<"members" | "open">("members");
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    async function load() {
      const { data } = await insforge.database
        .from("races")
        .select(
          "id, title, description, date, location, distance_km, max_participants, image_url, access",
        )
        .eq("id", id)
        .limit(1);

      const row = (data as Race[] | null)?.[0];
      if (!row) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setTitle(row.title);
      setDescription(row.description ?? "");
      setDate(row.date ? row.date.split("T")[0] : "");
      setTime(row.date?.split("T")[1]?.slice(0, 5) ?? "07:00");
      setLocation(row.location ?? "");
      setDistance(row.distance_km != null ? String(row.distance_km) : "");
      setMaxParticipants(
        row.max_participants != null ? String(row.max_participants) : "",
      );
      setAccess(row.access ?? "members");
      setImageUrl(row.image_url ?? "");
      setLoading(false);
    }

    void load();
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle || !date) {
      setError("Title and date are required.");
      return;
    }

    setSaving(true);

    const { error: updateError } = await insforge.database
      .from("races")
      .update({
        title: trimmedTitle,
        description: description.trim() || null,
        date: time ? `${date}T${time}:00` : date,
        location: location.trim() || null,
        distance_km: parseFloat(distance) || null,
        max_participants: parseInt(maxParticipants) || null,
        access,
        image_url: imageUrl || null,
      })
      .eq("id", id);

    setSaving(false);

    if (updateError) {
      setError(
        (updateError as { message?: string })?.message ?? "Failed to save.",
      );
      return;
    }

    router.push("/dashboard/races");
  }

  async function handleDelete() {
    setDeleting(true);
    await insforge.database
      .from("race_registrations")
      .delete()
      .eq("race_id", id);
    await insforge.database.from("races").delete().eq("id", id);
    router.push("/dashboard/races");
  }

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
      <button
        onClick={() => router.back()}
        className="text-petroleum-400 hover:text-petroleum-700 mb-6 inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <IconArrowLeft />
        Back to Races
      </button>

      <form onSubmit={(e) => void handleSave(e)} noValidate>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-petroleum-700 text-3xl">
              {loading ? (
                <span className="bg-sand-100 inline-block h-8 w-56 animate-pulse rounded-lg" />
              ) : (
                title || "Edit Race"
              )}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Button
              href={`/dashboard/races/${id}/registrations`}
              variant="outline"
              size="md"
              className="gap-2"
            >
              <IconUsers />
              Registrations
            </Button>

            <Button
              type="button"
              variant="outline-danger"
              size="md"
              className="gap-2"
              onClick={() => setConfirmDelete(true)}
              disabled={loading}
            >
              <IconTrash />
              Delete
            </Button>

            <Button
              type="submit"
              variant="solid"
              size="md"
              className="gap-2"
              disabled={saving || loading}
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
                      Time
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
                      placeholder="Barcelona, Spain"
                      disabled={saving}
                      className={INPUT_CLASS}
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-petroleum-500 text-xs font-medium">
                      Distance
                    </label>
                    {loading ? (
                      <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
                    ) : (
                      <div className="relative">
                        <input
                          type="number"
                          value={distance}
                          onChange={(e) => setDistance(e.target.value)}
                          placeholder="42.2"
                          min="0"
                          step="0.1"
                          disabled={saving}
                          className={INPUT_CLASS + " pr-12"}
                        />
                        <span className="text-petroleum-400 pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm">
                          km
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
                        placeholder="500"
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
                      onChange={(e) =>
                        setAccess(e.target.value as "members" | "open")
                      }
                      disabled={saving}
                      className={INPUT_CLASS}
                    >
                      <option value="members">Members only</option>
                      <option value="open">Open · free for everyone</option>
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
                  folder="races"
                  value={imageUrl}
                  onChange={setImageUrl}
                />
              )}
            </div>
          </div>
        </div>
      </form>

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => !deleting && setConfirmDelete(false)}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-petroleum-700 text-xl">
              Delete race?
            </h2>
            <p className="text-petroleum-400 mt-2 text-sm">
              This will permanently delete{" "}
              <span className="text-petroleum-600 font-medium">{title}</span>{" "}
              and all its registrations. This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="md"
                className="gap-2"
                onClick={() => void handleDelete()}
                disabled={deleting}
              >
                {deleting ? <IconSpinner /> : <IconTrash />}
                {deleting ? "Deleting…" : "Yes, delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
