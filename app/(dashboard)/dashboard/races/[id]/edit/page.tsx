"use client";

import { useEffect, useReducer, useRef, useState, type Dispatch } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { notifySuccess } from "@/lib/feedback";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/image-upload";
import {
  IconUsers,
  IconTrash,
  IconCheckmark,
  IconSpinner,
} from "@/components/ui/icons";

type Race = {
  id: string;
  title: string;
  description: string | null;
  title_es: string | null;
  description_es: string | null;
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

// ─── State ────────────────────────────────────────────────────

type PageState = {
  loading: boolean;
  notFound: boolean;
  saving: boolean;
  deleting: boolean;
  confirmDelete: boolean;
  error: string | null;
  title: string;
  description: string;
  titleEs: string;
  descriptionEs: string;
  date: string;
  time: string;
  location: string;
  distance: string;
  maxParticipants: string;
  access: "members" | "open";
  imageUrl: string;
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
        location: string;
        distance: string;
        maxParticipants: string;
        access: "members" | "open";
        imageUrl: string;
      };
    }
  | { type: "LOAD_NOT_FOUND" }
  | { type: "SET_SAVING"; value: boolean }
  | { type: "SET_DELETING"; value: boolean }
  | { type: "OPEN_CONFIRM_DELETE" }
  | { type: "CLOSE_CONFIRM_DELETE" }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "SET_TITLE"; value: string }
  | { type: "SET_DESCRIPTION"; value: string }
  | { type: "SET_TITLE_ES"; value: string }
  | { type: "SET_DESCRIPTION_ES"; value: string }
  | { type: "SET_DATE"; value: string }
  | { type: "SET_TIME"; value: string }
  | { type: "SET_LOCATION"; value: string }
  | { type: "SET_DISTANCE"; value: string }
  | { type: "SET_MAX_PARTICIPANTS"; value: string }
  | { type: "SET_ACCESS"; value: "members" | "open" }
  | { type: "SET_IMAGE_URL"; value: string };

const initialState: PageState = {
  loading: true,
  notFound: false,
  saving: false,
  deleting: false,
  confirmDelete: false,
  error: null,
  title: "",
  description: "",
  titleEs: "",
  descriptionEs: "",
  date: "",
  time: "07:00",
  location: "",
  distance: "",
  maxParticipants: "",
  access: "members",
  imageUrl: "",
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
    case "OPEN_CONFIRM_DELETE":
      return { ...state, confirmDelete: true };
    case "CLOSE_CONFIRM_DELETE":
      return { ...state, confirmDelete: false };
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
    case "SET_LOCATION":
      return { ...state, location: action.value };
    case "SET_DISTANCE":
      return { ...state, distance: action.value };
    case "SET_MAX_PARTICIPANTS":
      return { ...state, maxParticipants: action.value };
    case "SET_ACCESS":
      return { ...state, access: action.value };
    case "SET_IMAGE_URL":
      return { ...state, imageUrl: action.value };
  }
}

// ─── ConfirmDeleteModal ───────────────────────────────────────

type ConfirmDeleteModalProps = {
  title: string;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

function ConfirmDeleteModal({
  title,
  deleting,
  onCancel,
  onConfirm,
}: ConfirmDeleteModalProps) {
  const t = useTranslations("dashboard.races.edit");
  const tCommon = useTranslations("dashboard.common");
  return (
    <div
      role="button"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={() => !deleting && onCancel()}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !deleting) onCancel();
      }}
    >
      <div
        role="dialog"
        className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-petroleum-700 text-xl">
          {t("deleteDialog.title")}
        </h2>
        <p className="text-petroleum-400 mt-2 text-sm">
          {t.rich("deleteDialog.body", {
            name: () => (
              <span className="text-petroleum-500 font-medium">{title}</span>
            ),
          })}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onCancel}
            disabled={deleting}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            variant="danger"
            size="md"
            className="gap-2"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? (
              <IconSpinner className="animate-spin" />
            ) : (
              <IconTrash />
            )}
            {deleting ? t("deleteDialog.deleting") : t("deleteDialog.confirm")}
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
  const t = useTranslations("dashboard.races.form");
  const tCommon = useTranslations("dashboard.common");
  const {
    loading,
    saving,
    title,
    description,
    date,
    time,
    location,
    distance,
    maxParticipants,
    access,
  } = state;
  const [lang, setLang] = useState<"en" | "es">("en");

  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-petroleum-500 text-sm font-semibold">
          {t("sections.details")}
        </h2>
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
              {l === "en" ? tCommon("english") : tCommon("spanish")}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        {lang === "en" ? (
          <>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="race-edit-title"
                className="text-petroleum-500 text-xs font-medium"
              >
                {t("fields.title")} <span className="text-red-400">*</span>
              </label>
              {loading ? (
                <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
              ) : (
                <input
                  id="race-edit-title"
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
                htmlFor="race-edit-description"
                className="text-petroleum-500 text-xs font-medium"
              >
                {t("fields.description")}{" "}
                <span className="text-red-400">*</span>
              </label>
              {loading ? (
                <div className="bg-sand-100 h-20 animate-pulse rounded-xl" />
              ) : (
                <textarea
                  id="race-edit-description"
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
                htmlFor="race-edit-title-es"
                className="text-petroleum-500 text-xs font-medium"
              >
                {t("fields.title")} <span className="text-red-400">*</span>
              </label>
              {loading ? (
                <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
              ) : (
                <input
                  id="race-edit-title-es"
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
                htmlFor="race-edit-description-es"
                className="text-petroleum-500 text-xs font-medium"
              >
                {t("fields.description")}{" "}
                <span className="text-red-400">*</span>
              </label>
              {loading ? (
                <div className="bg-sand-100 h-20 animate-pulse rounded-xl" />
              ) : (
                <textarea
                  id="race-edit-description-es"
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
              htmlFor="race-edit-date"
              className="text-petroleum-500 text-xs font-medium"
            >
              {t("fields.date")} <span className="text-red-400">*</span>
            </label>
            {loading ? (
              <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
            ) : (
              <input
                id="race-edit-date"
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
              htmlFor="race-edit-time"
              className="text-petroleum-500 text-xs font-medium"
            >
              {t("fields.time")}
            </label>
            {loading ? (
              <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
            ) : (
              <input
                id="race-edit-time"
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
            htmlFor="race-edit-location"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("fields.location")}
          </label>
          {loading ? (
            <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
          ) : (
            <input
              id="race-edit-location"
              type="text"
              value={location}
              onChange={(e) =>
                dispatch({
                  type: "SET_LOCATION",
                  value: e.target.value,
                })
              }
              placeholder={t("fields.locationPlaceholder")}
              disabled={saving}
              className={INPUT_CLASS}
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="race-edit-distance"
              className="text-petroleum-500 text-xs font-medium"
            >
              {t("fields.distance")}
            </label>
            {loading ? (
              <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
            ) : (
              <div className="relative">
                <input
                  id="race-edit-distance"
                  type="number"
                  value={distance}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_DISTANCE",
                      value: e.target.value,
                    })
                  }
                  placeholder={t("fields.distancePlaceholder")}
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
            <label
              htmlFor="race-edit-max-participants"
              className="text-petroleum-500 text-xs font-medium"
            >
              {t("fields.maxParticipants")}
            </label>
            {loading ? (
              <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
            ) : (
              <input
                id="race-edit-max-participants"
                type="number"
                value={maxParticipants}
                onChange={(e) =>
                  dispatch({
                    type: "SET_MAX_PARTICIPANTS",
                    value: e.target.value,
                  })
                }
                placeholder={t("fields.maxParticipantsPlaceholder")}
                min="1"
                disabled={saving}
                className={INPUT_CLASS}
              />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="race-edit-access"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("fields.access")}
          </label>
          {loading ? (
            <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
          ) : (
            <select
              id="race-edit-access"
              value={access}
              onChange={(e) =>
                dispatch({
                  type: "SET_ACCESS",
                  value: e.target.value as "members" | "open",
                })
              }
              disabled={saving}
              className={INPUT_CLASS}
            >
              <option value="members">{t("accessOptions.members")}</option>
              <option value="open">{t("accessOptions.open")}</option>
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
  const t = useTranslations("dashboard.races.form");
  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        {t("sections.coverImage")}
      </h2>
      {loading ? (
        <div className="bg-sand-100 h-36 animate-pulse rounded-xl" />
      ) : (
        <ImageUpload
          bucket="events"
          folder="races"
          value={imageUrl}
          onChange={(value) => dispatch({ type: "SET_IMAGE_URL", value })}
        />
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function EditRacePage() {
  const tToasts = useTranslations("dashboard.toasts");
  const t = useTranslations("dashboard.races.edit");
  const { id } = useParams<{ id: string }>();
  const { push, back } = useRouter();
  const [state, dispatch] = useReducer(reducer, initialState);

  const {
    loading,
    notFound,
    saving,
    deleting,
    confirmDelete,
    error,
    title,
    description,
    titleEs,
    descriptionEs,
    date,
    time,
    location,
    distance,
    maxParticipants,
    access,
    imageUrl,
  } = state;

  // useRef for tracking whether the save/delete is in-flight
  // (not read in render — used only inside async handlers)
  const savingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await insforge.database
        .from("races")
        .select(
          "id, title, description, title_es, description_es, date, location, distance_km, max_participants, image_url, access",
        )
        .eq("id", id)
        .limit(1);

      if (cancelled) return;

      const row = (data as Race[] | null)?.[0];
      if (!row) {
        dispatch({ type: "LOAD_NOT_FOUND" });
        return;
      }

      dispatch({
        type: "LOAD_SUCCESS",
        payload: {
          title: row.title,
          description: row.description ?? "",
          titleEs: row.title_es ?? "",
          descriptionEs: row.description_es ?? "",
          date: row.date ? row.date.split("T")[0] : "",
          time: row.date?.split("T")[1]?.slice(0, 5) ?? "07:00",
          location: row.location ?? "",
          distance: row.distance_km != null ? String(row.distance_km) : "",
          maxParticipants:
            row.max_participants != null ? String(row.max_participants) : "",
          access: row.access ?? "members",
          imageUrl: row.image_url ?? "",
        },
      });
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    dispatch({ type: "SET_ERROR", error: null });

    const trimmedTitle = title.trim();
    if (!trimmedTitle || !date) {
      dispatch({ type: "SET_ERROR", error: "Title and date are required." });
      return;
    }

    savingRef.current = true;
    dispatch({ type: "SET_SAVING", value: true });

    const { error: updateError } = await insforge.database
      .from("races")
      .update({
        title: trimmedTitle,
        description: description.trim() || null,
        title_es: titleEs.trim() || null,
        description_es: descriptionEs.trim() || null,
        date: time ? `${date}T${time}:00` : date,
        location: location.trim() || null,
        distance_km: parseFloat(distance) || null,
        max_participants: parseInt(maxParticipants) || null,
        access,
        image_url: imageUrl || null,
      })
      .eq("id", id);

    savingRef.current = false;
    dispatch({ type: "SET_SAVING", value: false });

    if (updateError) {
      dispatch({
        type: "SET_ERROR",
        error:
          (updateError as { message?: string })?.message ??
          t("errors.saveFailed"),
      });
      return;
    }

    notifySuccess(tToasts("raceSaved"));
    push("/dashboard/races");
  }

  async function handleDelete() {
    dispatch({ type: "SET_DELETING", value: true });
    await insforge.database
      .from("race_registrations")
      .delete()
      .eq("race_id", id);
    await insforge.database.from("races").delete().eq("id", id);
    notifySuccess(tToasts("raceDeleted"));
    push("/dashboard/races");
  }

  if (notFound) {
    return (
      <div className="text-petroleum-400 flex flex-col items-center justify-center py-24">
        <p className="text-sm">{t("notFound")}</p>
        <button
          onClick={() => back()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") back();
          }}
          className="hover:text-petroleum-700 mt-4 text-xs underline"
        >
          {t("goBack")}
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
              {t("title")}
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
              {t("registrations")}
            </Button>

            <Button
              type="button"
              variant="outline-danger"
              size="md"
              className="gap-2"
              onClick={() => dispatch({ type: "OPEN_CONFIRM_DELETE" })}
              disabled={loading}
            >
              <IconTrash />
              {t("delete")}
            </Button>

            <Button
              type="submit"
              variant="solid"
              size="md"
              className="gap-2"
              disabled={saving || loading}
            >
              {saving ? (
                <IconSpinner className="animate-spin" />
              ) : (
                <IconCheckmark />
              )}
              {saving ? t("saving") : t("save")}
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

      {confirmDelete && (
        <ConfirmDeleteModal
          title={title}
          deleting={deleting}
          onCancel={() => dispatch({ type: "CLOSE_CONFIRM_DELETE" })}
          onConfirm={() => void handleDelete()}
        />
      )}
    </div>
  );
}
