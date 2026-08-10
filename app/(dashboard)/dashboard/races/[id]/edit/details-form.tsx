"use client";

import { useState, type Dispatch } from "react";
import { useTranslations } from "next-intl";
import type { PageAction, PageState } from "./form-state";

const INPUT_CLASS =
  "border-sand-200 bg-white text-petroleum-700 placeholder:text-petroleum-300 focus:border-petroleum-400 focus:ring-petroleum-100 rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 w-full disabled:opacity-60";

const TEXTAREA_CLASS =
  "border-sand-200 bg-white text-petroleum-700 placeholder:text-petroleum-300 focus:border-petroleum-400 focus:ring-petroleum-100 rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 w-full resize-none min-h-[80px] disabled:opacity-60";

// ─── State ────────────────────────────────────────────────────

type DetailsFormProps = {
  state: PageState;
  dispatch: Dispatch<PageAction>;
  titleEs: string;
  descriptionEs: string;
};

export function DetailsForm({
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
