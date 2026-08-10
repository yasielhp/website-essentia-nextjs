"use client";

import { useEffect, useReducer, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { notifySuccess } from "@/lib/feedback";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { ReviewQuote, ReviewSettings } from "./review-fields";
import {
  computeInitials,
  initialState,
  reducer,
  type Review,
} from "./form-state";

// ─── Delete dialog ────────────────────────────────────────────

function DeleteDialog({
  deleting,
  onConfirm,
  onCancel,
}: {
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("dashboard.reviews.detail");
  const tCommon = useTranslations("dashboard.common");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-petroleum-700 text-xl">
            {t("deleteDialog.title")}
          </h3>
          <p className="text-petroleum-400 text-sm">{t("deleteDialog.body")}</p>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            variant="danger"
            size="md"
            onClick={onConfirm}
            disabled={deleting}
            className="w-full"
          >
            {deleting ? t("deleteDialog.deleting") : t("deleteDialog.confirm")}
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={onCancel}
            disabled={deleting}
            className="w-full"
          >
            {tCommon("cancel")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

const statusBadgeClasses: Record<string, string> = {
  published: "bg-green-100 text-green-800",
  draft: "bg-yellow-100 text-yellow-800",
};

export default function ReviewDetailPage() {
  const tToasts = useTranslations("dashboard.toasts");
  const t = useTranslations("dashboard.reviews.detail");
  const { push } = useRouter();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [state, dispatch] = useReducer(reducer, initialState);
  const {
    submitting,
    deleting,
    error,
    quote,
    name,
    age,
    initials,
    status,
    displayOrder,
  } = state;

  useEffect(() => {
    void insforge.database
      .from("reviews")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data, error: dbError }) => {
        if (dbError || !data) {
          setNotFound(true);
        } else {
          dispatch({ type: "INIT", review: data as Review });
        }
        setLoading(false);
      });
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!quote.trim() || !name.trim()) return;
    dispatch({ type: "SAVE_START" });

    const { error: dbError } = await insforge.database
      .from("reviews")
      .update({
        quote: quote.trim(),
        name: name.trim(),
        age: age.trim(),
        initials: initials.trim() || computeInitials(name.trim()),
        status,
        display_order: displayOrder,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (dbError) {
      dispatch({
        type: "SAVE_ERROR",
        message:
          (dbError as { message?: string })?.message ?? t("errors.saveFailed"),
      });
    } else {
      dispatch({ type: "SAVE_SUCCESS" });
      notifySuccess(tToasts("reviewSaved"));
    }
  }

  async function handleDelete() {
    dispatch({ type: "DELETE_START" });
    await insforge.database.from("reviews").delete().eq("id", id);
    notifySuccess(tToasts("reviewDeleted"));
    push("/dashboard/reviews");
  }

  if (loading) {
    return (
      <div className="px-6 py-8 lg:px-10">
        <div className="mb-6 flex items-center justify-between">
          <div className="bg-sand-100 h-9 w-48 animate-pulse rounded-xl" />
          <div className="flex gap-3">
            <div className="bg-sand-100 h-9 w-20 animate-pulse rounded-full" />
            <div className="bg-sand-100 h-9 w-28 animate-pulse rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6">
          <div className="border-sand-200 rounded-2xl border bg-white p-6">
            <div className="bg-sand-100 mb-4 h-4 w-16 animate-pulse rounded" />
            <div className="bg-sand-100 h-28 animate-pulse rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="px-6 py-8 lg:px-10">
        <p className="text-petroleum-400 text-sm">{t("notFound")}</p>
        <Button
          variant="outline"
          size="md"
          href="/dashboard/reviews"
          className="mt-4"
        >
          {t("backToList")}
        </Button>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <form onSubmit={(e) => void handleSave(e)} noValidate>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-petroleum-700 text-3xl">
              {t("title")}
            </h1>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadgeClasses[status] ?? ""}`}
            >
              {status}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline-danger"
              size="md"
              type="button"
              onClick={() => setDeleteOpen(true)}
              disabled={deleting || submitting}
            >
              {t("delete")}
            </Button>
            <Button
              type="submit"
              variant="solid"
              size="md"
              disabled={submitting || !quote.trim() || !name.trim()}
            >
              {submitting ? t("saving") : t("saveChanges")}
            </Button>
          </div>
        </div>

        {error && (
          <p className="mb-6 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left col — Quote */}
          <ReviewQuote state={state} dispatch={dispatch} />

          {/* Right col — Settings */}
          <ReviewSettings state={state} dispatch={dispatch} />
        </div>
      </form>

      {deleteOpen && (
        <DeleteDialog
          deleting={deleting}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleteOpen(false)}
        />
      )}
    </div>
  );
}
