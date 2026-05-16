"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/image-upload";

type AccessType = "members_only" | "open" | "paid" | "paid_members_free";

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

export default function NewSessionPage() {
  const { push, back } = useRouter();

  const [submitting, setSubmitting] = useState(false);
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle || !date || !time) {
      setError("Title, date and time are required.");
      return;
    }

    setSubmitting(true);

    const isoDateTime = new Date(date + "T" + time).toISOString();

    const { error: insertError } = await insforge.database
      .from("education_sessions")
      .insert([
        {
          title: trimmedTitle,
          description: description.trim() || null,
          date: isoDateTime,
          duration_minutes: parseInt(duration) || null,
          location: location.trim() || null,
          max_participants: parseInt(maxParticipants) || null,
          image_url: imageUrl || null,
          access,
        },
      ]);

    setSubmitting(false);

    if (insertError) {
      setError(
        (insertError as { message?: string })?.message ??
          "Failed to create session.",
      );
      return;
    }

    push("/dashboard/education");
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <button
        onClick={() => back()}
        className="text-petroleum-400 hover:text-petroleum-700 mb-6 inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <IconArrowLeft />
        Back to Education
      </button>

      <form onSubmit={(e) => void handleCreate(e)} noValidate>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-petroleum-700 text-3xl">
              New Session
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="md" href="/dashboard/education">
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
                  <label
                    htmlFor="edu-title"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="edu-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Introduction to Breathwork"
                    disabled={submitting}
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="edu-description"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    Description
                  </label>
                  <textarea
                    id="edu-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="A brief overview of the session…"
                    disabled={submitting}
                    className={TEXTAREA_CLASS}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="edu-date"
                      className="text-petroleum-500 text-xs font-medium"
                    >
                      Date <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="edu-date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      disabled={submitting}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="edu-time"
                      className="text-petroleum-500 text-xs font-medium"
                    >
                      Time <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="edu-time"
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      disabled={submitting}
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="edu-location"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    Location
                  </label>
                  <input
                    id="edu-location"
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Studio A"
                    disabled={submitting}
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="edu-duration"
                      className="text-petroleum-500 text-xs font-medium"
                    >
                      Duration
                    </label>
                    <div className="relative">
                      <input
                        id="edu-duration"
                        type="number"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
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
                    <label
                      htmlFor="edu-max-participants"
                      className="text-petroleum-500 text-xs font-medium"
                    >
                      Max participants
                    </label>
                    <input
                      id="edu-max-participants"
                      type="number"
                      value={maxParticipants}
                      onChange={(e) => setMaxParticipants(e.target.value)}
                      placeholder="20"
                      min="1"
                      disabled={submitting}
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="edu-access"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    Access
                  </label>
                  <select
                    id="edu-access"
                    value={access}
                    onChange={(e) => setAccess(e.target.value as AccessType)}
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
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="border-sand-200 rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
                Cover Image
              </h2>
              <ImageUpload
                bucket="events"
                folder="education"
                value={imageUrl}
                onChange={setImageUrl}
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
