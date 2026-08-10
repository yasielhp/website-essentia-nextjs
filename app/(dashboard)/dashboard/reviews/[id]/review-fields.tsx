"use client";

import { type Dispatch } from "react";
import { useTranslations } from "next-intl";
import {
  INPUT_CLASS,
  SELECT_CLASS,
  TEXTAREA_CLASS,
} from "@/constants/form-styles";
import { computeInitials, type FormAction, type FormState } from "./form-state";

/**
 * The two columns of a review: what somebody said, and how it is shown.
 *
 * A hundred and sixty lines of form inside a five-hundred-line page that also
 * loads the review, saves it and deletes it.
 */
export function ReviewQuote({
  state,
  dispatch,
}: {
  state: FormState;
  dispatch: Dispatch<FormAction>;
}) {
  const t = useTranslations("dashboard.reviews.detail");
  const tForm = useTranslations("dashboard.reviews.form");
  const { submitting, quote, name, age, initials } = state;

  // The initials follow the name unless somebody types over them, which is
  // why they are set together rather than derived at render.
  function handleNameChange(value: string) {
    dispatch({ type: "SET_FIELD", field: "name", value });
    dispatch({
      type: "SET_FIELD",
      field: "initials",
      value: computeInitials(value),
    });
  }

  return (
    <div className="flex flex-col gap-6 lg:col-span-2">
      <div className="border-sand-200 rounded-2xl border bg-white p-6">
        <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
          {t("sections.review")}
        </h2>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="quote"
            className="text-petroleum-500 text-xs font-medium"
          >
            {tForm("fields.quote")} <span className="text-red-400">*</span>
          </label>
          <textarea
            id="quote"
            value={quote}
            onChange={(e) =>
              dispatch({
                type: "SET_FIELD",
                field: "quote",
                value: e.target.value,
              })
            }
            rows={5}
            disabled={submitting}
            className={TEXTAREA_CLASS}
          />
        </div>
      </div>

      <div className="border-sand-200 rounded-2xl border bg-white p-6">
        <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
          {t("sections.author")}
        </h2>
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="name"
              className="text-petroleum-500 text-xs font-medium"
            >
              {tForm("fields.name")} <span className="text-red-400">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              disabled={submitting}
              className={INPUT_CLASS}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="age"
                className="text-petroleum-500 text-xs font-medium"
              >
                {tForm("fields.age")}
              </label>
              <input
                id="age"
                type="number"
                min={1}
                max={120}
                value={age}
                onChange={(e) =>
                  dispatch({
                    type: "SET_FIELD",
                    field: "age",
                    value: e.target.value,
                  })
                }
                placeholder={tForm("fields.agePlaceholder")}
                disabled={submitting}
                className={INPUT_CLASS}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="initials"
                className="text-petroleum-500 text-xs font-medium"
              >
                {tForm("fields.initials")}
              </label>
              <input
                id="initials"
                type="text"
                value={initials}
                onChange={(e) =>
                  dispatch({
                    type: "SET_FIELD",
                    field: "initials",
                    value: e.target.value.toUpperCase(),
                  })
                }
                maxLength={3}
                disabled={submitting}
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReviewSettings({
  state,
  dispatch,
}: {
  state: FormState;
  dispatch: Dispatch<FormAction>;
}) {
  const t = useTranslations("dashboard.reviews.detail");
  const tReviews = useTranslations("dashboard.reviews");
  const tStatus = useTranslations("dashboard.reviews.status");
  const { submitting, status, displayOrder } = state;

  return (
    <div className="flex flex-col gap-6">
      <div className="border-sand-200 rounded-2xl border bg-white p-6">
        <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
          {t("sections.settings")}
        </h2>
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="status"
              className="text-petroleum-500 text-xs font-medium"
            >
              {tReviews("columns.status")}
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) =>
                dispatch({
                  type: "SET_STATUS",
                  value: e.target.value as "draft" | "published",
                })
              }
              disabled={submitting}
              className={SELECT_CLASS}
            >
              <option value="draft">{tStatus("draft")}</option>
              <option value="published">{tStatus("published")}</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="order"
              className="text-petroleum-500 text-xs font-medium"
            >
              {t("fields.displayOrder")}
            </label>
            <input
              id="order"
              type="number"
              min={1}
              value={displayOrder}
              onChange={(e) =>
                dispatch({
                  type: "SET_ORDER",
                  // A cleared field is "" and reads back as 0, and a
                  // half-typed one as NaN; both then went into the row.
                  value: Number.parseInt(e.target.value, 10) || 1,
                })
              }
              disabled={submitting}
              className={INPUT_CLASS}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
