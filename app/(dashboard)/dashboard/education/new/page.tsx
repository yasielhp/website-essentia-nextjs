"use client";

import { useState, useReducer } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { notifySuccess } from "@/lib/feedback";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/image-upload";
import { SessionFields } from "./session-fields";
import { formReducer } from "./form-state";

// ─── Form Reducer ─────────────────────────────────────────────

export default function NewSessionPage() {
  const t = useTranslations("dashboard.education.form");
  const tToasts = useTranslations("dashboard.toasts");
  const tCommon = useTranslations("dashboard.common");
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
      setError(t("errors.required"));
      return;
    }

    setSubmitting(true);

    const isoDateTime = new Date(form.date + "T" + form.time).toISOString();

    // The reset lives in a `finally`: a rejected insert — a dropped
    // connection, a 500 — skipped the line below and left the form disabled
    // behind a spinner that never stopped.
    try {
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

      if (insertError) {
        setError(
          (insertError as { message?: string })?.message ??
            t("errors.createFailed"),
        );
        return;
      }
    } finally {
      setSubmitting(false);
    }

    notifySuccess(tToasts("sessionCreated"));
    push("/dashboard/education");
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <form onSubmit={(e) => void handleCreate(e)} noValidate>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-petroleum-700 text-3xl">
              {t("title")}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="md" href="/dashboard/education">
              {tCommon("cancel")}
            </Button>
            <Button
              type="submit"
              variant="solid"
              size="md"
              disabled={submitting}
            >
              {submitting ? t("creating") : t("createSession")}
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
            <SessionFields
              form={form}
              dispatch={dispatch}
              submitting={submitting}
            />
          </div>

          <div className="space-y-5">
            <div className="border-sand-200 rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
                {t("sections.coverImage")}
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
