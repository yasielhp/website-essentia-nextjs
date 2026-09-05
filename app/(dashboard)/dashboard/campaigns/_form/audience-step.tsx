"use client";

import { useEffect, useState, type Dispatch } from "react";
import { useTranslations } from "next-intl";
import { getAccessToken } from "@/lib/client-session";
import { notifySuccess } from "@/lib/feedback";
import { INPUT_CLASS } from "@/constants/form-styles";
import { bookableServices } from "@/data/services-data";
import { MultiOptionSelect } from "@/components/ui/multi-option-select";
import { OptionSelect, type SelectOption } from "@/components/ui/option-select";
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
  type SegmentConditions,
  type SegmentList,
} from "@/types/campaign";
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
    hasBooked: audience.hasBooked ?? false,
  };
}

const EVERYONE: SegmentConditions = conditionsOf(EMPTY_AUDIENCE);

/** The dropdown value that means "build a new one" rather than a segment id. */
const NEW_SEGMENT = "__new__";

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

  const languageOptions: SelectOption<CampaignLanguage>[] = LANGUAGES.map(
    ({ value, key }) => ({ value, label: t(key) }),
  );
  const subscriptionOptions: SelectOption<"any" | "only">[] = [
    { value: "any", label: t("subscriptionAny") },
    { value: "only", label: t("subscriptionOnly") },
  ];
  const bookingsOptions: SelectOption<"any" | "booked" | "never">[] = [
    { value: "any", label: t("bookingsAny") },
    { value: "booked", label: t("bookingsBooked") },
    { value: "never", label: t("bookingsNever") },
  ];
  const lastBookingOptions: SelectOption<"" | "gt" | "lt">[] = [
    { value: "", label: t("lastBookingOff") },
    { value: "gt", label: t("lastBookingGt") },
    { value: "lt", label: t("lastBookingLt") },
  ];
  const bookings = audience.neverBooked
    ? "never"
    : audience.hasBooked
      ? "booked"
      : "any";

  const field = (id: string, label: string, control: React.ReactNode) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-petroleum-500 text-xs font-medium">
        {label}
      </label>
      {control}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {field(
        "segment-language",
        t("language"),
        <OptionSelect
          id="segment-language"
          value={audience.language}
          options={languageOptions}
          disabled={disabled}
          onChange={(language) =>
            dispatch({ type: "SET_AUDIENCE", patch: { language } })
          }
        />,
      )}

      {field(
        "segment-subscription",
        t("subscription"),
        <OptionSelect
          id="segment-subscription"
          value={audience.newsletter === true ? "only" : "any"}
          options={subscriptionOptions}
          disabled={disabled}
          onChange={(value) =>
            dispatch({
              type: "SET_AUDIENCE",
              patch: { newsletter: value === "only" ? true : null },
            })
          }
        />,
      )}

      {field(
        "segment-bookings",
        t("bookings"),
        <OptionSelect
          id="segment-bookings"
          value={bookings}
          options={bookingsOptions}
          disabled={disabled}
          onChange={(value) =>
            dispatch({
              type: "SET_AUDIENCE",
              patch: {
                neverBooked: value === "never",
                hasBooked: value === "booked",
              },
            })
          }
        />,
      )}

      {!audience.neverBooked && (
        <>
          {field(
            "campaign-services",
            t("services"),
            <MultiOptionSelect
              id="campaign-services"
              value={audience.services}
              options={SERVICE_OPTIONS}
              placeholder={t("servicesPlaceholder")}
              disabled={disabled}
              onChange={(services) =>
                dispatch({ type: "SET_AUDIENCE", patch: { services } })
              }
            />,
          )}

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="segment-last-booking"
              className="text-petroleum-500 text-xs font-medium"
            >
              {t("lastBooking")}
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <OptionSelect
                  id="segment-last-booking"
                  value={lastBooking ? lastBooking.op : ""}
                  options={lastBookingOptions}
                  disabled={disabled}
                  onChange={(op) =>
                    dispatch({
                      type: "SET_AUDIENCE",
                      patch: {
                        lastBooking: op
                          ? { op, days: lastBooking?.days ?? 60 }
                          : null,
                      },
                    })
                  }
                />
              </div>
              {lastBooking && (
                <div className="flex items-center gap-2">
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
                    className={`${INPUT_CLASS} w-28`}
                  />
                  <span className="text-petroleum-400 text-sm">
                    {t("daysAgo")}
                  </span>
                </div>
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
  const { audience, reach, submitting, segmentId } = state;

  const [list, setList] = useState<SegmentList | null>(null);
  const segments = list?.segments ?? null;
  const [editor, setEditor] = useState<
    | { mode: "closed" }
    | { mode: "new"; name: string }
    | { mode: "edit"; id: string; name: string }
  >({ mode: "closed" });
  const [savingSegment, setSavingSegment] = useState(false);
  const [segmentError, setSegmentError] = useState<string | null>(null);

  const [counting, setCounting] = useState(false);

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
          } else {
            dispatch({ type: "SET_REACH", reach: { count: 0, en: 0, es: 0 } });
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
    // A new segment starts from everyone, and narrows from there.
    dispatch({
      type: "SET_SEGMENT",
      id: null,
      name: null,
      conditions: EVERYONE,
    });
    setEditor({ mode: "new", name: "" });
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
    const saved = { ...result.segment, count: reach?.count ?? 0 };
    setList((current) => {
      const rest = (current?.segments ?? []).filter((s) => s.id !== saved.id);
      return {
        everyone: current?.everyone ?? 0,
        segments: [...rest, saved].sort((a, b) => a.name.localeCompare(b.name)),
      };
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

  const segmentOptions: SelectOption<string>[] = [
    {
      value: "",
      label: list ? `${tSeg("everyone")} (${list.everyone})` : tSeg("everyone"),
    },
    ...(segments ?? []).map((segment) => ({
      value: segment.id,
      label: `${segment.name} (${segment.count})`,
    })),
    // Always last, after every saved segment.
    { value: NEW_SEGMENT, label: tSeg("createOption") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <section className="border-sand-200 animate-fade-in-up rounded-2xl border bg-white p-6">
        <h2 className="text-petroleum-500 mb-1 text-sm font-semibold">
          {tSeg("title")}
        </h2>
        <p className="text-petroleum-400 mb-4 text-xs">{tSeg("hint")}</p>

        {!editing && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="sm:flex-1">
              <OptionSelect
                id="campaign-segment"
                value={segmentId ?? ""}
                options={segmentOptions}
                disabled={submitting || segments === null}
                ariaLabel={tSeg("title")}
                placeholder={tSeg("everyone")}
                onChange={(value) => {
                  // "New segment" lives in the list itself, at the end:
                  // choosing it opens the builder instead of picking.
                  if (value === NEW_SEGMENT) openNew();
                  else pickSegment(value);
                }}
              />
            </div>
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
                size="md"
                disabled={submitting || counting || !reach || reach.count === 0}
                onClick={onDone}
              >
                {t("confirm")}
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
        {!editing && !counting && reach && reach.count === 0 && (
          <p className="mt-3 text-xs font-medium text-red-600">
            {t("reachNone")}
          </p>
        )}
      </section>
    </div>
  );
}
