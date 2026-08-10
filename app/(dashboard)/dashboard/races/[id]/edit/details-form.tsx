"use client";

import { useState, type Dispatch } from "react";
import { useTranslations } from "next-intl";
import {
  LangToggle,
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/dashboard/form-fields";
import type { PageAction, PageState } from "./form-state";

type RaceAccess = "members" | "open";

const ACCESS_VALUES: RaceAccess[] = ["members", "open"];

/**
 * Everything about a race except its picture: what it is called in both
 * languages, when it happens, where, how far, for how many, and who may enter.
 */
export function DetailsForm({
  state,
  dispatch,
  titleEs,
  descriptionEs,
}: {
  state: PageState;
  dispatch: Dispatch<PageAction>;
  titleEs: string;
  descriptionEs: string;
}) {
  const t = useTranslations("dashboard.races.form");
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

  const shared = { loading, disabled: saving };

  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-petroleum-500 text-sm font-semibold">
          {t("sections.details")}
        </h2>
        <LangToggle lang={lang} onChange={setLang} />
      </div>

      <div className="space-y-4">
        {lang === "en" ? (
          <>
            <TextField
              {...shared}
              id="race-edit-title"
              label={t("fields.title")}
              required
              value={title}
              onChange={(value) => dispatch({ type: "SET_TITLE", value })}
            />
            <TextAreaField
              {...shared}
              id="race-edit-description"
              label={t("fields.description")}
              required
              value={description}
              onChange={(value) => dispatch({ type: "SET_DESCRIPTION", value })}
            />
          </>
        ) : (
          <>
            <TextField
              {...shared}
              id="race-edit-title-es"
              label={t("fields.title")}
              required
              value={titleEs}
              onChange={(value) => dispatch({ type: "SET_TITLE_ES", value })}
            />
            <TextAreaField
              {...shared}
              id="race-edit-description-es"
              label={t("fields.description")}
              required
              value={descriptionEs}
              onChange={(value) =>
                dispatch({ type: "SET_DESCRIPTION_ES", value })
              }
            />
          </>
        )}

        <div className="grid grid-cols-2 gap-4">
          <TextField
            {...shared}
            type="date"
            id="race-edit-date"
            label={t("fields.date")}
            required
            value={date}
            onChange={(value) => dispatch({ type: "SET_DATE", value })}
          />
          <TextField
            {...shared}
            type="time"
            id="race-edit-time"
            label={t("fields.time")}
            required
            value={time}
            onChange={(value) => dispatch({ type: "SET_TIME", value })}
          />
        </div>

        <TextField
          {...shared}
          id="race-edit-location"
          label={t("fields.location")}
          value={location}
          placeholder={t("fields.locationPlaceholder")}
          onChange={(value) => dispatch({ type: "SET_LOCATION", value })}
        />

        <div className="grid grid-cols-2 gap-4">
          <NumberField
            {...shared}
            id="race-edit-distance"
            label={t("fields.distance")}
            value={distance}
            placeholder={t("fields.distancePlaceholder")}
            unit="km"
            min="0"
            step="0.1"
            onChange={(value) => dispatch({ type: "SET_DISTANCE", value })}
          />
          <NumberField
            {...shared}
            id="race-edit-max-participants"
            label={t("fields.maxParticipants")}
            value={maxParticipants}
            placeholder={t("fields.maxParticipantsPlaceholder")}
            min="1"
            onChange={(value) =>
              dispatch({ type: "SET_MAX_PARTICIPANTS", value })
            }
          />
        </div>

        <SelectField
          {...shared}
          id="race-edit-access"
          label={t("fields.access")}
          value={access}
          options={ACCESS_VALUES.map((value) => ({
            value,
            label: t(`accessOptions.${value}`),
          }))}
          onChange={(value) =>
            dispatch({ type: "SET_ACCESS", value: value as RaceAccess })
          }
        />
      </div>
    </div>
  );
}
