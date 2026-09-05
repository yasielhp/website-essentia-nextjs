"use client";

import { useEffect, useState, type Dispatch } from "react";
import { useTranslations } from "next-intl";
import { getAccessToken } from "@/lib/client-session";
import { INPUT_CLASS, SELECT_CLASS } from "@/constants/form-styles";
import { bookableServices } from "@/data/services-data";
import { MultiOptionSelect } from "@/components/ui/multi-option-select";
import { ToggleRow } from "@/components/dashboard/toggle-row";
import { previewAudience } from "@/actions/campaigns";
import { Button } from "@/components/ui/button";
import type { CampaignLanguage } from "@/types/campaign";
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

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

/**
 * Who gets it: the conditions, the hand-picked extras, and a live count.
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
  const { audience, pickedContacts, reach, submitting } = state;
  const [sample, setSample] = useState<
    { id: string; name: string; email: string; language: string }[]
  >([]);
  const [showSample, setShowSample] = useState(false);
  const [counting, setCounting] = useState(false);

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

  const lastBooking = audience.lastBooking;

  return (
    <div className="flex flex-col gap-4">
      <Card title={t("title")}>
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
                  disabled={submitting}
                  onClick={() =>
                    dispatch({
                      type: "SET_AUDIENCE",
                      patch: { language: value },
                    })
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
          disabled={submitting}
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
          disabled={submitting}
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
                disabled={submitting || audience.neverBooked}
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
                  disabled={submitting || audience.neverBooked}
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
                  className={SELECT_CLASS}
                >
                  <option value="">{t("lastBookingOff")}</option>
                  <option value="gt">{t("lastBookingGt")}</option>
                  <option value="lt">{t("lastBookingLt")}</option>
                </select>
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={lastBooking?.days ?? ""}
                  disabled={submitting || !lastBooking}
                  aria-label={t("daysAgo")}
                  onChange={(e) => {
                    if (!lastBooking) return;
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
                  aria-describedby="campaign-last-booking-days"
                />
                <span className="text-petroleum-400 self-center text-sm">
                  {t("daysAgo")}
                </span>
              </div>
              {state.fieldErrors["audience.lastBooking.days"] && (
                <p className="text-xs text-red-500">
                  {state.fieldErrors["audience.lastBooking.days"]}
                </p>
              )}
            </div>
          </>
        )}
      </Card>

      <Card title={t("manual")}>
        <ContactPicker
          picked={pickedContacts}
          dispatch={dispatch}
          disabled={submitting}
        />
      </Card>

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
          disabled={submitting || counting || !reach || reach.count === 0}
          onClick={onDone}
        >
          {t("confirm")}
        </Button>
      </div>
    </div>
  );
}
