"use client";

import type { Dispatch } from "react";
import { useTranslations } from "next-intl";
import { INPUT_CLASS } from "@/constants/form-styles";
import type { FormAction, FormState } from "./form-state";

const TEXTAREA_CLASS =
  "border-sand-200 bg-white text-petroleum-700 placeholder:text-petroleum-300 focus:border-petroleum-400 focus:ring-petroleum-100 rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 w-full resize-none min-h-[80px] disabled:opacity-60";

/**
 * Everything a race is, as fields.
 *
 * The page keeps the submit and the row it writes; this is the part somebody
 * fills in, and it was two hundred lines in the middle of it.
 */
export function RaceFields({
  form,
  dispatch,
  submitting,
}: {
  form: FormState;
  dispatch: Dispatch<FormAction>;
  submitting: boolean;
}) {
  const t = useTranslations("dashboard.races.form");

  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        {t("sections.details")}
      </h2>
      <div className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="race-title"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("fields.title")} <span className="text-red-400">*</span>
          </label>
          <input
            id="race-title"
            type="text"
            value={form.title}
            onChange={(e) =>
              dispatch({
                type: "SET_FIELD",
                field: "title",
                value: e.target.value,
              })
            }
            placeholder={t("fields.titlePlaceholder")}
            disabled={submitting}
            className={INPUT_CLASS}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="race-description"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("fields.description")}
          </label>
          <textarea
            id="race-description"
            value={form.description}
            onChange={(e) =>
              dispatch({
                type: "SET_FIELD",
                field: "description",
                value: e.target.value,
              })
            }
            placeholder={t("fields.descriptionPlaceholder")}
            disabled={submitting}
            className={TEXTAREA_CLASS}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="race-date"
              className="text-petroleum-500 text-xs font-medium"
            >
              {t("fields.date")} <span className="text-red-400">*</span>
            </label>
            <input
              id="race-date"
              type="date"
              value={form.date}
              onChange={(e) =>
                dispatch({
                  type: "SET_FIELD",
                  field: "date",
                  value: e.target.value,
                })
              }
              disabled={submitting}
              className={INPUT_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="race-time"
              className="text-petroleum-500 text-xs font-medium"
            >
              {t("fields.time")}
            </label>
            <input
              id="race-time"
              type="time"
              value={form.time}
              onChange={(e) =>
                dispatch({
                  type: "SET_FIELD",
                  field: "time",
                  value: e.target.value,
                })
              }
              disabled={submitting}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="race-location"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("fields.location")}
          </label>
          <input
            id="race-location"
            type="text"
            value={form.location}
            onChange={(e) =>
              dispatch({
                type: "SET_FIELD",
                field: "location",
                value: e.target.value,
              })
            }
            placeholder={t("fields.locationPlaceholder")}
            disabled={submitting}
            className={INPUT_CLASS}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="race-distance"
              className="text-petroleum-500 text-xs font-medium"
            >
              {t("fields.distance")}
            </label>
            <div className="relative">
              <input
                id="race-distance"
                type="number"
                value={form.distance}
                onChange={(e) =>
                  dispatch({
                    type: "SET_FIELD",
                    field: "distance",
                    value: e.target.value,
                  })
                }
                placeholder={t("fields.distancePlaceholder")}
                min="0"
                step="0.1"
                disabled={submitting}
                className={INPUT_CLASS + " pr-12"}
              />
              <span className="text-petroleum-400 pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm">
                km
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="race-max-participants"
              className="text-petroleum-500 text-xs font-medium"
            >
              {t("fields.maxParticipants")}
            </label>
            <input
              id="race-max-participants"
              type="number"
              value={form.maxParticipants}
              onChange={(e) =>
                dispatch({
                  type: "SET_FIELD",
                  field: "maxParticipants",
                  value: e.target.value,
                })
              }
              placeholder={t("fields.maxParticipantsPlaceholder")}
              min="1"
              disabled={submitting}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="race-access"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("fields.access")}
          </label>
          <select
            id="race-access"
            value={form.access}
            onChange={(e) =>
              dispatch({
                type: "SET_ACCESS",
                value: e.target.value as "members" | "open",
              })
            }
            disabled={submitting}
            className={INPUT_CLASS}
          >
            <option value="members">{t("accessOptions.members")}</option>
            <option value="open">{t("accessOptions.open")}</option>
          </select>
        </div>
      </div>
    </div>
  );
}
