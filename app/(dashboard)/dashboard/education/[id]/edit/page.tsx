"use client";

import { useEffect, useReducer, useRef, useState, type Dispatch } from "react";
import { useParams, useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/image-upload";
import {
  IconUsers,
  IconTrash,
  IconCheckmark,
  IconSpinner,
} from "@/components/ui/icons";

type AccessType = "members_only" | "open" | "paid" | "paid_members_free";

type Session = {
  id: string;
  title: string;
  description: string | null;
  title_es: string | null;
  description_es: string | null;
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

// ─── State ────────────────────────────────────────────────────

type PageState = {
  loading: boolean;
  notFound: boolean;
  saving: boolean;
  deleting: boolean;
  deleteOpen: boolean;
  error: string | null;
  title: string;
  description: string;
  titleEs: string;
  descriptionEs: string;
  date: string;
  time: string;
  duration: string;
  location: string;
  maxParticipants: string;
  imageUrl: string;
  access: AccessType;
};

type PageAction =
  | {
      type: "LOAD_SUCCESS";
      payload: {
        title: string;
        description: string;
        titleEs: string;
        descriptionEs: string;
        date: string;
        time: string;
        duration: string;
        location: string;
        maxParticipants: string;
        imageUrl: string;
        access: AccessType;
      };
    }
  | { type: "LOAD_NOT_FOUND" }
  | { type: "SET_SAVING"; value: boolean }
  | { type: "SET_DELETING"; value: boolean }
  | { type: "OPEN_DELETE_DIALOG" }
  | { type: "CLOSE_DELETE_DIALOG" }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "SET_TITLE"; value: string }
  | { type: "SET_DESCRIPTION"; value: string }
  | { type: "SET_TITLE_ES"; value: string }
  | { type: "SET_DESCRIPTION_ES"; value: string }
  | { type: "SET_DATE"; value: string }
  | { type: "SET_TIME"; value: string }
  | { type: "SET_DURATION"; value: string }
  | { type: "SET_LOCATION"; value: string }
  | { type: "SET_MAX_PARTICIPANTS"; value: string }
  | { type: "SET_IMAGE_URL"; value: string }
  | { type: "SET_ACCESS"; value: AccessType };

const initialState: PageState = {
  loading: true,
  notFound: false,
  saving: false,
  deleting: false,
  deleteOpen: false,
  error: null,
  title: "",
  description: "",
  titleEs: "",
  descriptionEs: "",
  date: "",
  time: "",
  duration: "",
  location: "",
  maxParticipants: "",
  imageUrl: "",
  access: "members_only",
};

function reducer(state: PageState, action: PageAction): PageState {
  switch (action.type) {
    case "LOAD_SUCCESS":
      return { ...state, loading: false, ...action.payload };
    case "LOAD_NOT_FOUND":
      return { ...state, loading: false, notFound: true };
    case "SET_SAVING":
      return { ...state, saving: action.value };
    case "SET_DELETING":
      return { ...state, deleting: action.value };
    case "OPEN_DELETE_DIALOG":
      return { ...state, deleteOpen: true };
    case "CLOSE_DELETE_DIALOG":
      return { ...state, deleteOpen: false };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "SET_TITLE":
      return { ...state, title: action.value };
    case "SET_DESCRIPTION":
      return { ...state, description: action.value };
    case "SET_TITLE_ES":
      return { ...state, titleEs: action.value };
    case "SET_DESCRIPTION_ES":
      return { ...state, descriptionEs: action.value };
    case "SET_DATE":
      return { ...state, date: action.value };
    case "SET_TIME":
      return { ...state, time: action.value };
    case "SET_DURATION":
      return { ...state, duration: action.value };
    case "SET_LOCATION":
      return { ...state, location: action.value };
    case "SET_MAX_PARTICIPANTS":
      return { ...state, maxParticipants: action.value };
    case "SET_IMAGE_URL":
      return { ...state, imageUrl: action.value };
    case "SET_ACCESS":
      return { ...state, access: action.value };
  }
}

// ─── DeleteModal ──────────────────────────────────────────────

type DeleteModalProps = {
  title: string;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

function DeleteModal({
  title,
  deleting,
  onCancel,
  onConfirm,
}: DeleteModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-petroleum-700 text-xl">
            Delete session?
          </h3>
          <p className="text-petroleum-400 text-sm">
            <strong className="text-petroleum-500 font-medium">{title}</strong>{" "}
            will be permanently deleted along with all its enrollments.
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

// ─── DetailsForm ──────────────────────────────────────────────

type DetailsFormProps = {
  state: PageState;
  dispatch: Dispatch<PageAction>;
  titleEs: string;
  descriptionEs: string;
};

function DetailsForm({
  state,
  dispatch,
  titleEs,
  descriptionEs,
}: DetailsFormProps) {
  const {
    loading,
    saving,
    title,
    description,
    date,
    time,
    duration,
    location,
    maxParticipants,
    access,
  } = state;
  const [lang, setLang] = useState<"en" | "es">("en");

  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-petroleum-500 text-sm font-semibold">Details</h2>
        <div className="bg-sand-100 flex gap-1 rounded-lg p-1">
          {(["en", "es"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={[
                "rounded-md px-3 py-1 text-xs font-semibold tracking-wide uppercase transition-colors",
                lang === l
                  ? "text-petroleum-700 bg-white shadow-sm"
                  : "text-petroleum-400 hover:text-petroleum-600",
              ].join(" ")}
            >
              {l === "en" ? "English" : "Español"}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        {lang === "en" ? (
          <>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="edu-edit-title"
                className="text-petroleum-500 text-xs font-medium"
              >
                Title <span className="text-red-400">*</span>
              </label>
              {loading ? (
                <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
              ) : (
                <input
                  id="edu-edit-title"
                  type="text"
                  value={title}
                  onChange={(e) =>
                    dispatch({ type: "SET_TITLE", value: e.target.value })
                  }
                  disabled={saving}
                  className={INPUT_CLASS}
                />
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="edu-edit-description"
                className="text-petroleum-500 text-xs font-medium"
              >
                Description <span className="text-red-400">*</span>
              </label>
              {loading ? (
                <div className="bg-sand-100 h-20 animate-pulse rounded-xl" />
              ) : (
                <textarea
                  id="edu-edit-description"
                  value={description}
                  onChange={(e) =>
                    dispatch({ type: "SET_DESCRIPTION", value: e.target.value })
                  }
                  disabled={saving}
                  className={TEXTAREA_CLASS}
                />
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="edu-edit-title-es"
                className="text-petroleum-500 text-xs font-medium"
              >
                Title <span className="text-red-400">*</span>
              </label>
              {loading ? (
                <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
              ) : (
                <input
                  id="edu-edit-title-es"
                  type="text"
                  value={titleEs}
                  onChange={(e) =>
                    dispatch({ type: "SET_TITLE_ES", value: e.target.value })
                  }
                  disabled={saving}
                  className={INPUT_CLASS}
                />
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="edu-edit-description-es"
                className="text-petroleum-500 text-xs font-medium"
              >
                Description <span className="text-red-400">*</span>
              </label>
              {loading ? (
                <div className="bg-sand-100 h-20 animate-pulse rounded-xl" />
              ) : (
                <textarea
                  id="edu-edit-description-es"
                  value={descriptionEs}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_DESCRIPTION_ES",
                      value: e.target.value,
                    })
                  }
                  disabled={saving}
                  className={TEXTAREA_CLASS}
                />
              )}
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="edu-edit-date"
              className="text-petroleum-500 text-xs font-medium"
            >
              Date <span className="text-red-400">*</span>
            </label>
            {loading ? (
              <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
            ) : (
              <input
                id="edu-edit-date"
                type="date"
                value={date}
                onChange={(e) =>
                  dispatch({ type: "SET_DATE", value: e.target.value })
                }
                disabled={saving}
                className={INPUT_CLASS}
              />
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="edu-edit-time"
              className="text-petroleum-500 text-xs font-medium"
            >
              Time <span className="text-red-400">*</span>
            </label>
            {loading ? (
              <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
            ) : (
              <input
                id="edu-edit-time"
                type="time"
                value={time}
                onChange={(e) =>
                  dispatch({ type: "SET_TIME", value: e.target.value })
                }
                disabled={saving}
                className={INPUT_CLASS}
              />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="edu-edit-location"
            className="text-petroleum-500 text-xs font-medium"
          >
            Location
          </label>
          {loading ? (
            <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
          ) : (
            <input
              id="edu-edit-location"
              type="text"
              value={location}
              onChange={(e) =>
                dispatch({
                  type: "SET_LOCATION",
                  value: e.target.value,
                })
              }
              placeholder="Studio A"
              disabled={saving}
              className={INPUT_CLASS}
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="edu-edit-duration"
              className="text-petroleum-500 text-xs font-medium"
            >
              Duration
            </label>
            {loading ? (
              <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
            ) : (
              <div className="relative">
                <input
                  id="edu-edit-duration"
                  type="number"
                  value={duration}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_DURATION",
                      value: e.target.value,
                    })
                  }
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
            <label
              htmlFor="edu-edit-max-participants"
              className="text-petroleum-500 text-xs font-medium"
            >
              Max participants
            </label>
            {loading ? (
              <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
            ) : (
              <input
                id="edu-edit-max-participants"
                type="number"
                value={maxParticipants}
                onChange={(e) =>
                  dispatch({
                    type: "SET_MAX_PARTICIPANTS",
                    value: e.target.value,
                  })
                }
                placeholder="20"
                min="1"
                disabled={saving}
                className={INPUT_CLASS}
              />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="edu-edit-access"
            className="text-petroleum-500 text-xs font-medium"
          >
            Access
          </label>
          {loading ? (
            <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
          ) : (
            <select
              id="edu-edit-access"
              value={access}
              onChange={(e) =>
                dispatch({
                  type: "SET_ACCESS",
                  value: e.target.value as AccessType,
                })
              }
              disabled={saving}
              className={INPUT_CLASS}
            >
              <option value="members_only">Members only</option>
              <option value="open">Open · free for everyone</option>
              <option value="paid">Paid</option>
              <option value="paid_members_free">Paid · free for members</option>
            </select>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SidebarCard ──────────────────────────────────────────────

type SidebarCardProps = {
  loading: boolean;
  imageUrl: string;
  dispatch: Dispatch<PageAction>;
};

function SidebarCard({ loading, imageUrl, dispatch }: SidebarCardProps) {
  return (
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
          onChange={(value) => dispatch({ type: "SET_IMAGE_URL", value })}
        />
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function EditSessionPage() {
  const { id } = useParams<{ id: string }>();
  const { push, back } = useRouter();
  const [state, dispatch] = useReducer(reducer, initialState);

  const {
    loading,
    notFound,
    saving,
    deleting,
    deleteOpen,
    error,
    title,
    description,
    titleEs,
    descriptionEs,
    date,
    time,
    duration,
    location,
    maxParticipants,
    imageUrl,
    access,
  } = state;

  // useRef for tracking whether save is in-flight
  // (not read in render — used only inside async handlers)
  const savingRef = useRef(false);

  useEffect(() => {
    async function load() {
      const { data } = await insforge.database
        .from("education_sessions")
        .select(
          "id, title, description, title_es, description_es, date, duration_minutes, location, max_participants, image_url, access",
        )
        .eq("id", id)
        .limit(1);

      const row = (data as Session[] | null)?.[0];
      if (!row) {
        dispatch({ type: "LOAD_NOT_FOUND" });
        return;
      }

      const dt = new Date(row.date);
      const dateStr = dt.toISOString().split("T")[0];
      const timeStr = dt.toTimeString().slice(0, 5);

      dispatch({
        type: "LOAD_SUCCESS",
        payload: {
          title: row.title,
          description: row.description ?? "",
          titleEs: row.title_es ?? "",
          descriptionEs: row.description_es ?? "",
          date: dateStr,
          time: timeStr,
          duration:
            row.duration_minutes != null ? String(row.duration_minutes) : "",
          location: row.location ?? "",
          maxParticipants:
            row.max_participants != null ? String(row.max_participants) : "",
          imageUrl: row.image_url ?? "",
          access: row.access ?? "members_only",
        },
      });
    }

    void load();
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    dispatch({ type: "SET_ERROR", error: null });

    const trimmedTitle = title.trim();
    if (!trimmedTitle || !date || !time) {
      dispatch({
        type: "SET_ERROR",
        error: "Title, date and time are required.",
      });
      return;
    }

    savingRef.current = true;
    dispatch({ type: "SET_SAVING", value: true });

    const isoDateTime = new Date(date + "T" + time).toISOString();

    const { error: updateError } = await insforge.database
      .from("education_sessions")
      .update({
        title: trimmedTitle,
        description: description.trim() || null,
        title_es: titleEs.trim() || null,
        description_es: descriptionEs.trim() || null,
        date: isoDateTime,
        duration_minutes: parseInt(duration) || null,
        location: location.trim() || null,
        max_participants: parseInt(maxParticipants) || null,
        image_url: imageUrl || null,
        access,
      })
      .eq("id", id);

    savingRef.current = false;
    dispatch({ type: "SET_SAVING", value: false });

    if (updateError) {
      dispatch({
        type: "SET_ERROR",
        error:
          (updateError as { message?: string })?.message ?? "Failed to save.",
      });
      return;
    }

    push("/dashboard/education");
  }

  async function handleDelete() {
    dispatch({ type: "SET_DELETING", value: true });
    await insforge.database
      .from("education_registrations")
      .delete()
      .eq("session_id", id);
    await insforge.database.from("education_sessions").delete().eq("id", id);
    push("/dashboard/education");
  }

  if (notFound) {
    return (
      <div className="text-petroleum-400 flex flex-col items-center justify-center py-24">
        <p className="text-sm">Session not found.</p>
        <button
          onClick={() => back()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") back();
          }}
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
          <div>
            <h1 className="font-display text-petroleum-700 text-3xl">
              Edit Session
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
              onClick={() => dispatch({ type: "OPEN_DELETE_DIALOG" })}
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
              {saving ? (
                <IconSpinner className="animate-spin" />
              ) : (
                <IconCheckmark />
              )}
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
            <DetailsForm
              state={state}
              dispatch={dispatch}
              titleEs={titleEs}
              descriptionEs={descriptionEs}
            />
          </div>

          <div className="space-y-5">
            <SidebarCard
              loading={loading}
              imageUrl={imageUrl}
              dispatch={dispatch}
            />
          </div>
        </div>
      </form>

      {deleteOpen && (
        <DeleteModal
          title={title}
          deleting={deleting}
          onCancel={() => dispatch({ type: "CLOSE_DELETE_DIALOG" })}
          onConfirm={() => void handleDelete()}
        />
      )}
    </div>
  );
}
