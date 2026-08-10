"use client";

import type { Dispatch } from "react";
import { useTranslations } from "next-intl";
import { INPUT_CLASS } from "@/constants/form-styles";

const TEXTAREA_CLASS =
  "border-sand-200 bg-white text-petroleum-700 placeholder:text-petroleum-300 focus:border-petroleum-400 focus:ring-petroleum-100 rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 w-full resize-none min-h-[80px] disabled:opacity-60";
import type { AccessType, FormAction, FormState } from "./form-state";

/**
 * Everything a session is, as fields.
 *
 * The page keeps the submit and the row it writes; this is the part someone
 * fills in, and it was two hundred lines in the middle of it.
 */
export function SessionFields({
  form,
  dispatch,
  submitting,
}: {
  form: FormState;
  dispatch: Dispatch<FormAction>;
  submitting: boolean;
}) {
  const t = useTranslations("dashboard.education.new");

  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        {t("sections.details")}
      </h2>
      <div className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="edu-title"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("fields.title")} <span className="text-red-400">*</span>
          </label>
          <input
            id="edu-title"
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
            htmlFor="edu-description"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("fields.description")}
          </label>
          <textarea
            id="edu-description"
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
              htmlFor="edu-date"
              className="text-petroleum-500 text-xs font-medium"
            >
              {t("fields.date")} <span className="text-red-400">*</span>
            </label>
            <input
              id="edu-date"
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
              htmlFor="edu-time"
              className="text-petroleum-500 text-xs font-medium"
            >
              {t("fields.time")} <span className="text-red-400">*</span>
            </label>
            <input
              id="edu-time"
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
            htmlFor="edu-location"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("fields.location")}
          </label>
          <input
            id="edu-location"
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
              htmlFor="edu-duration"
              className="text-petroleum-500 text-xs font-medium"
            >
              {t("fields.duration")}
            </label>
            <div className="relative">
              <input
                id="edu-duration"
                type="number"
                value={form.duration}
                onChange={(e) =>
                  dispatch({
                    type: "SET_FIELD",
                    field: "duration",
                    value: e.target.value,
                  })
                }
                placeholder={t("fields.durationPlaceholder")}
                min="1"
                disabled={submitting}
                className={INPUT_CLASS + " pr-12"}
              />
              <span className="text-petroleum-400 pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm">
                min
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="edu-max-participants"
              className="text-petroleum-500 text-xs font-medium"
            >
              {t("fields.maxParticipants")}
            </label>
            <input
              id="edu-max-participants"
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
            htmlFor="edu-access"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("fields.access")}
          </label>
          <select
            id="edu-access"
            value={form.access}
            onChange={(e) =>
              dispatch({
                type: "SET_ACCESS",
                value: e.target.value as AccessType,
              })
            }
            disabled={submitting}
            className={INPUT_CLASS}
          >
            <option value="members_only">
              {t("accessOptions.members_only")}
            </option>
            <option value="open">{t("accessOptions.open")}</option>
            <option value="paid">{t("accessOptions.paid")}</option>
            <option value="paid_members_free">
              {t("accessOptions.paid_members_free")}
            </option>
          </select>
        </div>
      </div>
    </div>
  );
}
