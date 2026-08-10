"use client";

import { useEffect, useReducer, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { notifySuccess } from "@/lib/feedback";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteModal } from "./confirm-delete-modal";
import { DetailsForm } from "./details-form";
import { SidebarCard } from "./sidebar-card";
import { initialState, reducer, type Race } from "./form-state";
import {
  IconUsers,
  IconTrash,
  IconCheckmark,
  IconSpinner,
} from "@/components/ui/icons";

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
