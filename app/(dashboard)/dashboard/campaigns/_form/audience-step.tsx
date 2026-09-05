"use client";

import { useEffect, useState, type Dispatch } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { getAccessToken } from "@/lib/client-session";
import { INPUT_CLASS } from "@/constants/form-styles";
import { bookableServices } from "@/data/services-data";
import { MultiOptionSelect } from "@/components/ui/multi-option-select";
import { OptionSelect, type SelectOption } from "@/components/ui/option-select";
import { Button } from "@/components/ui/button";
import { listSegments, previewAudience } from "@/actions/campaigns";
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

/** The conditions half of an audience; the send language stays with the campaign. */
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

export const EVERYONE: SegmentConditions = conditionsOf(EMPTY_AUDIENCE);

/**
 * The condition controls, on their own so the segments page and nothing else
 * owns them. `dispatch` only ever receives `SET_AUDIENCE`, which is why a
 * plain `useState` setter wrapped to that shape is enough on the segments page.
 */
export function AudienceConditions({
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
 * Who gets it: a saved segment, or everyone. Segments are built and edited on
 * their own page, so here there is one dropdown with counts and a confirm.
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
  const { audience, reach, submitting, segmentId } = state;

  const [list, setList] = useState<SegmentList | null>(null);
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

  // Every change re-counts, after a short pause so a quick succession of
  // picks costs one request rather than one each.
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
          dispatch({
            type: "SET_REACH",
            reach:
              "count" in result
                ? {
                    count: result.count,
                    en: result.byLanguage.en,
                    es: result.byLanguage.es,
                  }
                : { count: 0, en: 0, es: 0 },
          });
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [audienceKey, dispatch]);

  const segments = list?.segments ?? [];
  const selected = segments.find((s) => s.id === segmentId) ?? null;

  function pickSegment(id: string) {
    if (id === "") {
      dispatch({
        type: "SET_SEGMENT",
        id: null,
        name: null,
        conditions: EVERYONE,
      });
      return;
    }
    const segment = segments.find((s) => s.id === id);
    if (!segment) return;
    dispatch({
      type: "SET_SEGMENT",
      id: segment.id,
      name: segment.name,
      conditions: segment.conditions,
    });
  }

  const options: SelectOption<string>[] = [
    {
      value: "",
      label: list ? `${tSeg("everyone")} (${list.everyone})` : tSeg("everyone"),
    },
    ...segments.map((segment) => ({
      value: segment.id,
      label: `${segment.name} (${segment.count})`,
    })),
  ];

  return (
    <section className="border-sand-200 animate-fade-in-up rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-1 text-sm font-semibold">
        {tSeg("title")}
      </h2>
      <p className="text-petroleum-400 mb-4 text-xs">
        {tSeg("hint")}{" "}
        <Link
          href="/dashboard/campaigns/segments"
          className="text-petroleum-500 hover:text-petroleum-700 underline underline-offset-2"
        >
          {tSeg("manage")}
        </Link>
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:flex-1">
          <OptionSelect
            id="campaign-segment"
            value={segmentId ?? ""}
            options={options}
            disabled={submitting || list === null}
            ariaLabel={tSeg("title")}
            placeholder={tSeg("everyone")}
            onChange={pickSegment}
          />
        </div>
        <Button
          size="md"
          disabled={submitting || counting || !reach || reach.count === 0}
          onClick={onDone}
        >
          {t("confirm")}
        </Button>
      </div>

      {selected && (
        <p className="text-petroleum-400 mt-3 text-xs">
          {tSeg("selectedHint", { name: selected.name })}
        </p>
      )}
      {!counting && reach && reach.count === 0 && (
        <p className="mt-3 text-xs font-medium text-red-600">
          {t("reachNone")}
        </p>
      )}
    </section>
  );
}
