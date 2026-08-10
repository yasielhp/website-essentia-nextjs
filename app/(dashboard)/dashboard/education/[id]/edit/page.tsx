"use client";

import { useEffect, useReducer, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { notifySuccess } from "@/lib/feedback";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { DeleteModal } from "./delete-modal";
import { DetailsForm } from "./details-form";
import { SidebarCard } from "./sidebar-card";
import { initialState, reducer, type Session } from "./form-state";
import {
  IconUsers,
  IconTrash,
  IconCheckmark,
  IconSpinner,
} from "@/components/ui/icons";

// ─── Page ─────────────────────────────────────────────────────

export default function EditSessionPage() {
  const tToasts = useTranslations("dashboard.toasts");
  const t = useTranslations("dashboard.education.edit");
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
    let cancelled = false;

    async function load() {
      const { data } = await insforge.database
        .from("education_sessions")
        .select(
          "id, title, description, title_es, description_es, date, duration_minutes, location, max_participants, image_url, access",
        )
        .eq("id", id)
        .limit(1);

      if (cancelled) return;

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

    return () => {
      cancelled = true;
    };
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
          (updateError as { message?: string })?.message ??
          t("errors.saveFailed"),
      });
      return;
    }

    notifySuccess(tToasts("sessionSaved"));
    push("/dashboard/education");
  }

  async function handleDelete() {
    dispatch({ type: "SET_DELETING", value: true });
    await insforge.database
      .from("education_registrations")
      .delete()
      .eq("session_id", id);
    await insforge.database.from("education_sessions").delete().eq("id", id);
    notifySuccess(tToasts("sessionDeleted"));
    push("/dashboard/education");
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
              type="button"
              variant="outline"
              size="md"
              href={`/dashboard/education/${id}/enrollees`}
              className="gap-1.5"
            >
              <IconUsers />
              {t("enrollees")}
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
              {t("delete")}
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
