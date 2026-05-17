"use client";

import { useState, useReducer } from "react";
import { useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/image-upload";

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
  distance: string;
  location: string;
  maxParticipants: string;
  imageUrl: string;
  access: "members" | "open";
};

type FormAction =
  | { type: "SET_FIELD"; field: keyof Omit<FormState, "access">; value: string }
  | { type: "SET_ACCESS"; value: "members" | "open" };

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

export default function NewRacePage() {
  const { push } = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, dispatch] = useReducer(formReducer, {
    title: "",
    description: "",
    date: "",
    time: "07:00",
    distance: "",
    location: "",
    maxParticipants: "",
    imageUrl: "",
    access: "members",
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedTitle = form.title.trim();
    if (!trimmedTitle || !form.date) {
      setError("Title and date are required.");
      return;
    }

    setSubmitting(true);

    const dateTime = form.time ? `${form.date}T${form.time}:00` : form.date;

    const { error: insertError } = await insforge.database
      .from("races")
      .insert([
        {
          title: trimmedTitle,
          description: form.description.trim() || null,
          date: dateTime,
          location: form.location.trim() || null,
          distance_km: form.distance ? parseFloat(form.distance) || null : null,
          max_participants: form.maxParticipants
            ? parseInt(form.maxParticipants) || null
            : null,
          access: form.access,
          image_url: form.imageUrl || null,
        },
      ]);

    setSubmitting(false);

    if (insertError) {
      setError(
        (insertError as { message?: string })?.message ??
          "Failed to create race.",
      );
      return;
    }

    push("/dashboard/races");
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <form onSubmit={(e) => void handleCreate(e)} noValidate>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-petroleum-700 text-3xl">
              New Race
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="md" href="/dashboard/races">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="solid"
              size="md"
              disabled={submitting}
            >
              {submitting ? "Creating…" : "Create Race"}
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
                    htmlFor="race-title"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="race-title"
                    type="text"
                    value={form.title}
                    onChange={(e) =>
                      dispatch({
                        type: "SET_FIELD",
                        field: "title",
                        value: e.target.value,
                      })
                    }
                    placeholder="Essentia Marathon 2025"
                    disabled={submitting}
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="race-description"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    Description
                  </label>
                  <textarea
                    id="race-description"
                    value={form.description}
                    onChange={(e) =>
                      dispatch({
                        type: "SET_FIELD",
                        field: "description",
                        value: e.target.value,
                      })
                    }
                    placeholder="Brief description of the race…"
                    disabled={submitting}
                    className={TEXTAREA_CLASS}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="race-date"
                      className="text-petroleum-500 text-xs font-medium"
                    >
                      Date <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="race-date"
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
                      htmlFor="race-time"
                      className="text-petroleum-500 text-xs font-medium"
                    >
                      Time
                    </label>
                    <input
                      id="race-time"
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
                    htmlFor="race-location"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    Location
                  </label>
                  <input
                    id="race-location"
                    type="text"
                    value={form.location}
                    onChange={(e) =>
                      dispatch({
                        type: "SET_FIELD",
                        field: "location",
                        value: e.target.value,
                      })
                    }
                    placeholder="Barcelona, Spain"
                    disabled={submitting}
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="race-distance"
                      className="text-petroleum-500 text-xs font-medium"
                    >
                      Distance
                    </label>
                    <div className="relative">
                      <input
                        id="race-distance"
                        type="number"
                        value={form.distance}
                        onChange={(e) =>
                          dispatch({
                            type: "SET_FIELD",
                            field: "distance",
                            value: e.target.value,
                          })
                        }
                        placeholder="42.2"
                        min="0"
                        step="0.1"
                        disabled={submitting}
                        className={INPUT_CLASS + " pr-12"}
                      />
                      <span className="text-petroleum-400 pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm">
                        km
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="race-max-participants"
                      className="text-petroleum-500 text-xs font-medium"
                    >
                      Max participants
                    </label>
                    <input
                      id="race-max-participants"
                      type="number"
                      value={form.maxParticipants}
                      onChange={(e) =>
                        dispatch({
                          type: "SET_FIELD",
                          field: "maxParticipants",
                          value: e.target.value,
                        })
                      }
                      placeholder="500"
                      min="1"
                      disabled={submitting}
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="race-access"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    Access
                  </label>
                  <select
                    id="race-access"
                    value={form.access}
                    onChange={(e) =>
                      dispatch({
                        type: "SET_ACCESS",
                        value: e.target.value as "members" | "open",
                      })
                    }
                    disabled={submitting}
                    className={INPUT_CLASS}
                  >
                    <option value="members">Members only</option>
                    <option value="open">Open · free for everyone</option>
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
                folder="races"
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
