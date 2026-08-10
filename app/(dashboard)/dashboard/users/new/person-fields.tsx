"use client";

import type { Dispatch } from "react";
import { useTranslations } from "next-intl";
import { INPUT_CLASS } from "@/constants/form-styles";
import { OptionSelect } from "@/components/ui/option-select";
import { EmailInput } from "@/components/ui/email-input";
import { LANGUAGE_OPTIONS } from "@/constants/i18n";
import { useGenderOptions } from "@/hooks/use-gender-options";
import { useFieldError } from "@/hooks/use-field-error";
import type { FormAction, FormState } from "./form-state";

/**
 * Who the person is, whatever kind of account they end up with.
 *
 * The role picker above decides what gets created — a profile with a login, or
 * a contact — but these fields are the same either way, and they were most of
 * the page.
 */
export function PersonFields({
  state,
  dispatch,
}: {
  state: FormState;
  dispatch: Dispatch<FormAction>;
}) {
  const t = useTranslations("dashboard.users.form");
  const genderOptions = useGenderOptions();
  const fieldError = useFieldError();
  const {
    submitting,
    fieldErrors,
    firstName,
    lastName,
    email,
    phone,
    gender,
    language,
  } = state;

  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        {t("sections.details")}
      </h2>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="firstName"
              className="text-petroleum-500 text-xs font-medium"
            >
              {t("fields.firstName")} <span className="text-red-400">*</span>
            </label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) =>
                dispatch({
                  type: "SET_FIELD",
                  field: "firstName",
                  value: e.target.value,
                })
              }
              placeholder={t("fields.firstNamePlaceholder")}
              disabled={submitting}
              className={INPUT_CLASS}
            />
            {fieldErrors.firstName && (
              <p className="text-xs text-red-500">
                {fieldError(fieldErrors.firstName)}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="lastName"
              className="text-petroleum-500 text-xs font-medium"
            >
              {t("fields.lastName")}
            </label>
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) =>
                dispatch({
                  type: "SET_FIELD",
                  field: "lastName",
                  value: e.target.value,
                })
              }
              placeholder={t("fields.lastNamePlaceholder")}
              disabled={submitting}
              className={INPUT_CLASS}
            />
            {fieldErrors.lastName && (
              <p className="text-xs text-red-500">
                {fieldError(fieldErrors.lastName)}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("fields.email")} <span className="text-red-400">*</span>
          </label>
          <EmailInput
            id="email"
            value={email}
            onChange={(value) =>
              dispatch({
                type: "SET_FIELD",
                field: "email",
                value: value,
              })
            }
            placeholder={t("fields.emailPlaceholder")}
            disabled={submitting}
            className={INPUT_CLASS}
          />
          {fieldErrors.email && (
            <p className="text-xs text-red-500">
              {fieldError(fieldErrors.email)}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="phone"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("fields.phone")}
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) =>
              dispatch({
                type: "SET_FIELD",
                field: "phone",
                value: e.target.value,
              })
            }
            placeholder={t("fields.phonePlaceholder")}
            disabled={submitting}
            className={INPUT_CLASS}
          />
          {fieldErrors.phone && (
            <p className="text-xs text-red-500">
              {fieldError(fieldErrors.phone)}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="gender"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("fields.gender")}
          </label>
          <OptionSelect
            id="gender"
            value={gender}
            options={genderOptions}
            onChange={(next) => dispatch({ type: "SET_GENDER", gender: next })}
            disabled={submitting}
            ariaLabel={t("fields.gender")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="language"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("fields.preferredLanguage")}
          </label>
          <OptionSelect
            id="language"
            value={language}
            options={LANGUAGE_OPTIONS}
            onChange={(next) =>
              dispatch({ type: "SET_LANGUAGE", language: next })
            }
            disabled={submitting}
            ariaLabel={t("fields.preferredLanguage")}
          />
        </div>
      </div>
    </div>
  );
}
