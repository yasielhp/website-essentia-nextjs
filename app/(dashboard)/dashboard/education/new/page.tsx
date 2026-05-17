"use client";

import { useState, useReducer } from "react";
import { useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/image-upload";

type AccessType = "members_only" | "open" | "paid" | "paid_members_free";

const INPUT_CLASS =
  "border-sand-200 bg-white text-petroleum-700 placeholder:text-petroleum-300 focus:border-petroleum-400 focus:ring-petroleum-100 rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 w-full disabled:opacity-60";

const TEXTAREA_CLASS =
  "border-sand-200 bg-white text-petroleum-700 placeholder:text-petroleum-300 focus:border-petroleum-400 focus:ring-petroleum-100 rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 w-full resize-none min-h-[80px] disabled:opacity-60";

// ─── Form Reducer ─────────────────────────────────────────────

type FormState = {
  title: string;
  description: string;
  date: string;
  time: string;
  duration: string;
  location: string;
  maxParticipants: string;
  imageUrl: string;
  access: AccessType;
};

type FormAction =
  | { type: "SET_FIELD"; field: keyof Omit<FormState, "access">; value: string }
  | { type: "SET_ACCESS"; value: AccessType };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SET_ACCESS":
      return { ...state, access: action.value };
    default:
      return state;
  }
}

// ─── Page ─────────────────────────────────────────────────────

export default function NewSessionPage() {
  const { push } = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, dispatch] = useReducer(formReducer, {
    title: "",
    description: "",
    date: "",
    time: "",
    duration: "",
    location: "",
    maxParticipants: "",
    imageUrl: "",
    access: "members_only",
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedTitle = form.title.trim();
    if (!trimmedTitle || !form.date || !form.time) {
      setError("Title, date and time are required.");
      return;
    }

    setSubmitting(true);

    const isoDateTime = new Date(form.date + "T" + form.time).toISOString();

    const { error: insertError } = await insforge.database
      .from("education_sessions")
      .insert([
        {
          title: trimmedTitle,
          description: form.description.trim() || null,
          date: isoDateTime,
          duration_minutes: parseInt(form.duration) || null,
          location: form.location.trim() || null,
          max_participants: parseInt(form.maxParticipants) || null,
          image_url: form.imageUrl || null,
          access: form.access,
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
                    value={form.title}
                    onChange={(e) =>
                      dispatch({
                        type: "SET_FIELD",
                        field: "title",
                        value: e.target.value,
                      })
                    }
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
                    value={form.description}
                    onChange={(e) =>
                      dispatch({
                        type: "SET_FIELD",
                        field: "description",
                        value: e.target.value,
                      })
                    }
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
                      value={form.date}
                      onChange={(e) =>
                        dispatch({
                          type: "SET_FIELD",
                          field: "date",
                          value: e.target.value,
                        })
                      }
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
                      value={form.time}
                      onChange={(e) =>
                        dispatch({
                          type: "SET_FIELD",
                          field: "time",
                          value: e.target.value,
                        })
                      }
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
                    value={form.location}
                    onChange={(e) =>
                      dispatch({
                        type: "SET_FIELD",
                        field: "location",
                        value: e.target.value,
                      })
                    }
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
                        value={form.duration}
                        onChange={(e) =>
                          dispatch({
                            type: "SET_FIELD",
                            field: "duration",
                            value: e.target.value,
                          })
                        }
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
                      value={form.maxParticipants}
                      onChange={(e) =>
                        dispatch({
                          type: "SET_FIELD",
                          field: "maxParticipants",
                          value: e.target.value,
                        })
                      }
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
                    value={form.access}
                    onChange={(e) =>
                      dispatch({
                        type: "SET_ACCESS",
                        value: e.target.value as AccessType,
                      })
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
                value={form.imageUrl}
                onChange={(val) =>
                  dispatch({ type: "SET_FIELD", field: "imageUrl", value: val })
                }
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
