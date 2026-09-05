"use client";

import { useEffect, useState, type Dispatch } from "react";
import { useTranslations } from "next-intl";
import { getAccessToken } from "@/lib/client-session";
import { notifySuccess } from "@/lib/feedback";
import { INPUT_CLASS, SELECT_CLASS } from "@/constants/form-styles";
import { bookableServices } from "@/data/services-data";
import { MultiOptionSelect } from "@/components/ui/multi-option-select";
import { ToggleRow } from "@/components/dashboard/toggle-row";
import { Button } from "@/components/ui/button";
import { useFieldError } from "@/hooks/use-field-error";
import {
  listSegments,
  previewAudience,
  saveSegment,
} from "@/actions/campaigns";
import {
  EMPTY_AUDIENCE,
  type CampaignAudience,
  type CampaignLanguage,
  type CampaignSegment,
  type SegmentConditions,
} from "@/types/campaign";
import { ContactPicker } from "./contact-picker";
import type { FormAction, FormState } from "./form-state";

const LANGUAGES: { value: CampaignLanguage; key: string }[] = [
  { value: "any", key: "languageAny" },
  { value: "en", key: "languageEn" },
  { value: "es", key: "languageEs" },
];

const SERVICE_OPTIONS = bookableServices.map((service) => ({
  value: service.id,
  label: service.title,
}));

/** The conditions half of an audience; the manual picks stay with the campaign. */
export function conditionsOf(audience: CampaignAudience): SegmentConditions {
  return {
    language: audience.language,
    newsletter: audience.newsletter,
    services: audience.services,
    lastBooking: audience.lastBooking,
    neverBooked: audience.neverBooked,
  };
}

const EVERYONE: SegmentConditions = conditionsOf(EMPTY_AUDIENCE);

/**
 * The condition controls, on their own so the segment editor and nothing else
 * owns them. Writes go straight to the campaign's audience; saving a segment
 * copies them out.
 */
function AudienceConditions({
  audience,
  fieldErrors,
  disabled,
  dispatch,
}: {
  audience: CampaignAudience;
  fieldErrors: Record<string, string>;
  disabled: boolean;
  dispatch: Dispatch<FormAction>;
}) {
  const t = useTranslations("dashboard.campaigns.audience");
  const lastBooking = audience.lastBooking;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-petroleum-500 text-xs font-medium">
          {t("language")}
        </span>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map(({ value, key }) => {
            const active = audience.language === value;
            return (
              <button
                key={value}
                type="button"
                disabled={disabled}
                onClick={() =>
                  dispatch({ type: "SET_AUDIENCE", patch: { language: value } })
                }
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-petroleum-700 text-white"
                    : "bg-sand-100 text-petroleum-500 hover:bg-sand-200"
                }`}
              >
                {t(key)}
              </button>
            );
          })}
        </div>
      </div>

      <ToggleRow
        checked={audience.newsletter === true}
        disabled={disabled}
        label={t("newsletter")}
        hint={t("newsletterHint")}
        onToggle={() =>
          dispatch({
            type: "SET_AUDIENCE",
            patch: { newsletter: audience.newsletter === true ? null : true },
          })
        }
      />

      <ToggleRow
        checked={audience.neverBooked}
        disabled={disabled}
        label={t("neverBooked")}
        hint={t("neverBookedHint")}
        onToggle={() =>
          dispatch({
            type: "SET_AUDIENCE",
            patch: { neverBooked: !audience.neverBooked },
          })
        }
      />

      {audience.neverBooked ? (
        <p className="text-petroleum-400 bg-sand-50 rounded-xl px-4 py-3 text-xs">
          {t("neverBookedNote")}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="campaign-services"
              className="text-petroleum-500 text-xs font-medium"
            >
              {t("services")}
            </label>
            <MultiOptionSelect
              id="campaign-services"
              value={audience.services}
              options={SERVICE_OPTIONS}
              placeholder={t("servicesPlaceholder")}
              disabled={disabled}
              onChange={(services) =>
                dispatch({ type: "SET_AUDIENCE", patch: { services } })
              }
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-petroleum-500 text-xs font-medium">
              {t("lastBooking")}
            </span>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={lastBooking ? lastBooking.op : ""}
                disabled={disabled}
                aria-label={t("lastBooking")}
                onChange={(e) => {
                  const op = e.target.value as "" | "gt" | "lt";
                  dispatch({
                    type: "SET_AUDIENCE",
                    patch: {
                      lastBooking: op
                        ? { op, days: lastBooking?.days ?? 60 }
                        : null,
                    },
                  });
                }}
                className={`${SELECT_CLASS} sm:max-w-xs`}
              >
                <option value="">{t("lastBookingOff")}</option>
                <option value="gt">{t("lastBookingGt")}</option>
                <option value="lt">{t("lastBookingLt")}</option>
              </select>
              {lastBooking && (
                <>
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    value={lastBooking.days || ""}
                    disabled={disabled}
                    aria-label={t("daysAgo")}
                    onChange={(e) => {
                      const days = Number(e.target.value);
                      dispatch({
                        type: "SET_AUDIENCE",
                        patch: {
                          lastBooking: {
                            op: lastBooking.op,
                            days: Number.isFinite(days) ? days : 0,
                          },
                        },
                      });
                    }}
                    className={`${INPUT_CLASS} sm:w-28`}
                  />
                  <span className="text-petroleum-400 self-center text-sm">
                    {t("daysAgo")}
                  </span>
                </>
              )}
            </div>
            {fieldErrors["audience.lastBooking.days"] && (
              <p className="text-xs text-red-500">
                {fieldErrors["audience.lastBooking.days"]}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Who gets it: a saved segment (or everyone), optional hand-picked extras, and
 * a live count. A segment is a named set of conditions kept for the next
 * campaign; editing one here writes the conditions into this campaign at once
 * and, on save, back into the segment.
 *
 * The count comes from the same resolver the send uses, so the number the
 * admin reads here is the number of emails that will go out.
 */
export function AudienceStep({
  state,
  dispatch,
  onDone,
}: {
  state: FormState;
  dispatch: Dispatch<FormAction>;
  /** Confirms the audience as it stands and opens the next step. */
  onDone: () => void;
}) {
  const t = useTranslations("dashboard.campaigns.audience");
  const tSeg = useTranslations("dashboard.campaigns.segment");
  const tToasts = useTranslations("dashboard.toasts");
  const fieldError = useFieldError();
  const { audience, pickedContacts, reach, submitting, segmentId } = state;

  const [segments, setSegments] = useState<CampaignSegment[] | null>(null);
  const [editor, setEditor] = useState<
    | { mode: "closed" }
    | { mode: "new"; name: string }
    | { mode: "edit"; id: string; name: string }
  >({ mode: "closed" });
  const [savingSegment, setSavingSegment] = useState(false);
  const [segmentError, setSegmentError] = useState<string | null>(null);

  const [sample, setSample] = useState<
    { id: string; name: string; email: string; language: string }[]
  >([]);
  const [showSample, setShowSample] = useState(false);
  const [counting, setCounting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void listSegments(getAccessToken())
      .catch(() => [])
      .then((rows) => {
        if (!cancelled) setSegments(rows);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Every change to the conditions re-counts, after a short pause so a number
  // being typed does not fire a request per digit.
  const audienceKey = JSON.stringify(audience);
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setCounting(true);
      void previewAudience(getAccessToken(), JSON.parse(audienceKey))
        .catch(() => ({ ok: false as const, error: "generic" }))
        .then((result) => {
          if (cancelled) return;
          setCounting(false);
          if ("count" in result) {
            dispatch({
              type: "SET_REACH",
              reach: {
                count: result.count,
                en: result.byLanguage.en,
                es: result.byLanguage.es,
              },
            });
            setSample(result.sample);
          } else {
            dispatch({ type: "SET_REACH", reach: { count: 0, en: 0, es: 0 } });
            setSample([]);
          }
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [audienceKey, dispatch]);

  const selected = segments?.find((s) => s.id === segmentId) ?? null;

  function pickSegment(id: string) {
    setEditor({ mode: "closed" });
    setSegmentError(null);
    if (id === "") {
      dispatch({
        type: "SET_SEGMENT",
        id: null,
        name: null,
        conditions: EVERYONE,
      });
      return;
    }
    const segment = segments?.find((s) => s.id === id);
    if (!segment) return;
    dispatch({
      type: "SET_SEGMENT",
      id: segment.id,
      name: segment.name,
      conditions: segment.conditions,
    });
  }

  function openNew() {
    setSegmentError(null);
    setEditor({ mode: "new", name: "" });
    // A new segment starts from the current conditions, whatever they are.
  }

  function openEdit() {
    if (!selected) return;
    setSegmentError(null);
    setEditor({ mode: "edit", id: selected.id, name: selected.name });
  }

  function cancelEditor() {
    setEditor({ mode: "closed" });
    setSegmentError(null);
    // Back to what the chosen segment says, or to everyone.
    if (selected) {
      dispatch({
        type: "SET_SEGMENT",
        id: selected.id,
        name: selected.name,
        conditions: selected.conditions,
      });
    } else {
      dispatch({
        type: "SET_SEGMENT",
        id: null,
        name: null,
        conditions: EVERYONE,
      });
    }
  }

  async function persistSegment() {
    if (editor.mode === "closed") return;
    const name = editor.name.trim();
    if (!name) {
      setSegmentError(fieldError("nameRequired"));
      return;
    }
    setSavingSegment(true);
    const result = await saveSegment(getAccessToken(), {
      id: editor.mode === "edit" ? editor.id : null,
      name,
      conditions: conditionsOf(audience),
    }).catch(() => ({ ok: false as const, error: "generic" }));
    setSavingSegment(false);
    if (!result.ok) {
      setSegmentError(
        result.error === "nameTaken"
          ? fieldError("nameTaken")
          : tSeg("saveFailed"),
      );
      return;
    }
    const saved = result.segment;
    setSegments((rows) => {
      const rest = (rows ?? []).filter((s) => s.id !== saved.id);
      return [...rest, saved].sort((a, b) => a.name.localeCompare(b.name));
    });
    dispatch({
      type: "SET_SEGMENT",
      id: saved.id,
      name: saved.name,
      conditions: saved.conditions,
    });
    setEditor({ mode: "closed" });
    notifySuccess(tToasts("segmentSaved"));
  }

  const editing = editor.mode !== "closed";

  return (
    <div className="flex flex-col gap-4">
      <section className="border-sand-200 animate-fade-in-up rounded-2xl border bg-white p-6">
        <h2 className="text-petroleum-500 mb-1 text-sm font-semibold">
          {tSeg("title")}
        </h2>
        <p className="text-petroleum-400 mb-4 text-xs">{tSeg("hint")}</p>

        {!editing && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              value={segmentId ?? ""}
              disabled={submitting || segments === null}
              aria-label={tSeg("title")}
              onChange={(e) => pickSegment(e.target.value)}
              className={`${SELECT_CLASS} sm:flex-1`}
            >
              <option value="">{tSeg("everyone")}</option>
              {(segments ?? []).map((segment) => (
                <option key={segment.id} value={segment.id}>
                  {segment.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              {selected && (
                <Button
                  variant="outline"
                  size="md"
                  disabled={submitting}
                  onClick={openEdit}
                >
                  {tSeg("edit")}
                </Button>
              )}
              <Button
                variant="soft"
                size="md"
                disabled={submitting || segments === null}
                onClick={openNew}
              >
                {tSeg("create")}
              </Button>
            </div>
          </div>
        )}

        {editing && (
          <div className="border-sand-200 bg-sand-50 flex flex-col gap-4 rounded-2xl border p-5">
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
                disabled={savingSegment}
                placeholder={tSeg("namePlaceholder")}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                className={INPUT_CLASS}
              />
              {segmentError && (
                <p className="text-xs text-red-500">{segmentError}</p>
              )}
            </div>

            <AudienceConditions
              audience={audience}
              fieldErrors={state.fieldErrors}
              disabled={savingSegment}
              dispatch={dispatch}
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-petroleum-400 text-xs">
                {counting || reach === null
                  ? t("counting")
                  : reach.count === 1
                    ? t("reachOne")
                    : t("reach", { count: reach.count })}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="md"
                  disabled={savingSegment}
                  onClick={cancelEditor}
                >
                  {tSeg("cancel")}
                </Button>
                <Button
                  size="md"
                  disabled={savingSegment || editor.name.trim() === ""}
                  onClick={() => void persistSegment()}
                >
                  {savingSegment ? tSeg("saving") : tSeg("save")}
                </Button>
              </div>
            </div>
          </div>
        )}

        {!editing && selected && (
          <p className="text-petroleum-400 mt-3 text-xs">
            {tSeg("selectedHint", { name: selected.name })}
          </p>
        )}
      </section>

      <section className="border-sand-200 rounded-2xl border bg-white p-6">
        <h2 className="text-petroleum-500 mb-1 text-sm font-semibold">
          {t("manual")}
        </h2>
        <p className="text-petroleum-400 mb-4 text-xs">{tSeg("manualHint")}</p>
        <ContactPicker
          picked={pickedContacts}
          dispatch={dispatch}
          disabled={submitting || editing}
        />
      </section>

      <div
        className={`rounded-2xl border p-5 ${
          reach && reach.count === 0
            ? "border-red-200 bg-red-50"
            : "border-petroleum-100 bg-petroleum-50"
        }`}
      >
        {counting || reach === null ? (
          <p className="text-petroleum-400 text-sm">{t("counting")}</p>
        ) : reach.count === 0 ? (
          <p className="text-sm font-medium text-red-600">{t("reachNone")}</p>
        ) : (
          <>
            <p className="text-petroleum-700 text-base font-medium">
              {reach.count === 1
                ? t("reachOne")
                : t("reach", { count: reach.count })}
            </p>
            <p className="text-petroleum-400 mt-0.5 text-xs">
              {t("reachByLanguage", { en: reach.en, es: reach.es })}
            </p>
            {sample.length > 0 && (
              <button
                type="button"
                onClick={() => setShowSample((v) => !v)}
                className="text-petroleum-500 hover:text-petroleum-700 mt-3 text-xs font-medium underline underline-offset-2"
              >
                {showSample ? t("sampleHide") : t("sample")}
              </button>
            )}
            {showSample && (
              <ul className="divide-sand-200 mt-2 divide-y text-xs">
                {sample.map((person) => (
                  <li
                    key={person.id}
                    className="text-petroleum-500 flex justify-between gap-3 py-1.5"
                  >
                    <span className="truncate">{person.name || "—"}</span>
                    <span className="text-petroleum-400 truncate">
                      {person.email} · {person.language.toUpperCase()}
                    </span>
                  </li>
                ))}
                {reach.count > sample.length && (
                  <li className="text-petroleum-400 py-1.5">
                    {t("sampleMore", { count: reach.count - sample.length })}
                  </li>
                )}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="flex justify-end">
        <Button
          size="md"
          disabled={
            submitting || editing || counting || !reach || reach.count === 0
          }
          onClick={onDone}
        >
          {t("confirm")}
        </Button>
      </div>
    </div>
  );
}
