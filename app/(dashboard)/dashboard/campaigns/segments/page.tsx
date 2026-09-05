"use client";

import { useCallback, useEffect, useState, type Dispatch } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { getAccessToken } from "@/lib/client-session";
import { notifySuccess } from "@/lib/feedback";
import { INPUT_CLASS } from "@/constants/form-styles";
import { Button } from "@/components/ui/button";
import { IconPlus, IconTrash } from "@/components/ui/icons";
import { useFieldError } from "@/hooks/use-field-error";
import {
  deleteSegment,
  listSegments,
  previewAudience,
  saveSegment,
} from "@/actions/campaigns";
import {
  EMPTY_AUDIENCE,
  type CampaignAudience,
  type SegmentList,
} from "@/types/campaign";
import { AudienceConditions, conditionsOf } from "../_form/audience-step";
import type { FormAction } from "../_form/form-state";

type Editor =
  | { mode: "closed" }
  | { mode: "new"; name: string; audience: CampaignAudience }
  | { mode: "edit"; id: string; name: string; audience: CampaignAudience };

/**
 * Saved segments: named sets of conditions the campaign form picks from.
 *
 * Built here, not inside a campaign, so a segment is a thing in its own right
 * — reused, renamed, retired — and the campaign step stays a single choice.
 */
export default function SegmentsPage() {
  const t = useTranslations("dashboard.campaigns.segments");
  const tSeg = useTranslations("dashboard.campaigns.segment");
  const tToasts = useTranslations("dashboard.toasts");
  const fieldError = useFieldError();

  const [list, setList] = useState<SegmentList | null>(null);
  const [editor, setEditor] = useState<Editor>({ mode: "closed" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [reach, setReach] = useState<number | null>(null);

  // Bumping `version` refetches; the effect owns the state update so a stale
  // response from a superseded fetch cannot land after a newer one.
  const [version, setVersion] = useState(0);
  const load = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    void listSegments(getAccessToken())
      .catch(() => ({ everyone: 0, segments: [] }))
      .then((rows) => {
        if (!cancelled) setList(rows);
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  // Live count while the conditions change, debounced like the campaign step.
  const audienceKey =
    editor.mode === "closed" ? "" : JSON.stringify(editor.audience);
  useEffect(() => {
    if (!audienceKey) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void previewAudience(getAccessToken(), JSON.parse(audienceKey))
        .catch(() => ({ ok: false as const, error: "generic" }))
        .then((result) => {
          if (!cancelled) setReach("count" in result ? result.count : 0);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [audienceKey]);

  // The condition controls speak the campaign form's action shape; only
  // SET_AUDIENCE ever arrives here.
  const dispatch: Dispatch<FormAction> = (action) => {
    if (action.type !== "SET_AUDIENCE" || editor.mode === "closed") return;
    const audience = { ...editor.audience, ...action.patch };
    if (audience.neverBooked) {
      audience.services = [];
      audience.lastBooking = null;
      audience.hasBooked = false;
    }
    setEditor({ ...editor, audience });
  };

  function openNew() {
    setError(null);
    setReach(null);
    setEditor({ mode: "new", name: "", audience: { ...EMPTY_AUDIENCE } });
  }

  function openEdit(id: string) {
    const segment = list?.segments.find((s) => s.id === id);
    if (!segment) return;
    setError(null);
    setReach(segment.count);
    setEditor({
      mode: "edit",
      id,
      name: segment.name,
      audience: { ...EMPTY_AUDIENCE, ...segment.conditions },
    });
  }

  async function save() {
    if (editor.mode === "closed") return;
    const name = editor.name.trim();
    if (!name) {
      setError(fieldError("nameRequired"));
      return;
    }
    setSaving(true);
    const result = await saveSegment(getAccessToken(), {
      id: editor.mode === "edit" ? editor.id : null,
      name,
      conditions: conditionsOf(editor.audience),
    }).catch(() => ({ ok: false as const, error: "generic" }));
    setSaving(false);
    if (!result.ok) {
      setError(
        result.error === "nameTaken"
          ? fieldError("nameTaken")
          : tSeg("saveFailed"),
      );
      return;
    }
    notifySuccess(tToasts("segmentSaved"));
    setEditor({ mode: "closed" });
    load();
  }

  async function remove(id: string) {
    const result = await deleteSegment(getAccessToken(), id).catch(() => ({
      ok: false as const,
      error: "generic",
    }));
    setConfirmDelete(null);
    if (!result.ok) {
      toast.error(tSeg("saveFailed"));
      return;
    }
    notifySuccess(tToasts("segmentDeleted"));
    load();
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-petroleum-700 text-3xl">
            {t("title")}
          </h1>
          <p className="text-petroleum-400 mt-1 text-sm">{t("hint")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="md" href="/dashboard/campaigns">
            {t("back")}
          </Button>
          <Button
            size="md"
            className="gap-2"
            disabled={editor.mode !== "closed"}
            onClick={openNew}
          >
            <IconPlus />
            {t("new")}
          </Button>
        </div>
      </div>

      {editor.mode !== "closed" && (
        <section className="border-sand-200 animate-fade-in-up mb-6 rounded-2xl border bg-white p-6">
          <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
            {editor.mode === "new" ? t("new") : t("editTitle")}
          </h2>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="segment-name"
                className="text-petroleum-500 text-xs font-medium"
              >
                {tSeg("name")}
              </label>
              <input
                id="segment-name"
                type="text"
                autoFocus
                value={editor.name}
                disabled={saving}
                placeholder={tSeg("namePlaceholder")}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                className={INPUT_CLASS}
              />
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>

            <AudienceConditions
              audience={editor.audience}
              fieldErrors={{}}
              disabled={saving}
              dispatch={dispatch}
            />

            <div className="border-sand-100 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="text-petroleum-500 text-sm">
                {reach === null ? t("counting") : t("reach", { count: reach })}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="md"
                  disabled={saving}
                  onClick={() => setEditor({ mode: "closed" })}
                >
                  {tSeg("cancel")}
                </Button>
                <Button
                  size="md"
                  disabled={saving || editor.name.trim() === ""}
                  onClick={() => void save()}
                >
                  {saving ? tSeg("saving") : tSeg("save")}
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="border-sand-200 overflow-hidden rounded-2xl border bg-white">
        {list === null ? (
          <div className="divide-sand-100 divide-y">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-5 py-4">
                <div className="bg-sand-100 h-4 w-48 animate-pulse rounded" />
              </div>
            ))}
          </div>
        ) : (
          <ul className="divide-sand-100 divide-y">
            <li className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <p className="text-petroleum-700 text-sm font-medium">
                  {tSeg("everyone")}
                </p>
                <p className="text-petroleum-400 text-xs">
                  {t("everyoneHint")}
                </p>
              </div>
              <span className="text-petroleum-500 text-sm tabular-nums">
                {t("count", { count: list.everyone })}
              </span>
            </li>
            {list.segments.length === 0 && (
              <li className="text-petroleum-400 px-5 py-10 text-center text-sm">
                {t("empty")}
              </li>
            )}
            {list.segments.map((segment) => (
              <li
                key={segment.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-petroleum-700 truncate text-sm font-medium">
                    {segment.name}
                  </p>
                  <p className="text-petroleum-400 text-xs">
                    {t("count", { count: segment.count })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {confirmDelete === segment.id ? (
                    <>
                      <span className="text-petroleum-500 text-xs">
                        {t("confirmDelete")}
                      </span>
                      <Button
                        variant="outline"
                        size="md"
                        onClick={() => setConfirmDelete(null)}
                      >
                        {tSeg("cancel")}
                      </Button>
                      <Button
                        size="md"
                        className="bg-red-600 hover:bg-red-700"
                        onClick={() => void remove(segment.id)}
                      >
                        {t("delete")}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="md"
                        disabled={editor.mode !== "closed"}
                        onClick={() => openEdit(segment.id)}
                      >
                        {tSeg("edit")}
                      </Button>
                      <button
                        type="button"
                        aria-label={t("delete")}
                        disabled={editor.mode !== "closed"}
                        onClick={() => setConfirmDelete(segment.id)}
                        className="text-petroleum-400 rounded-lg p-2 transition-colors hover:text-red-600 disabled:opacity-40"
                      >
                        <IconTrash />
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
