"use client";

import type { Dispatch } from "react";
import { useTranslations } from "next-intl";
import { INPUT_CLASS } from "@/constants/form-styles";
import { OptionSelect } from "@/components/ui/option-select";
import { EmailInput } from "@/components/ui/email-input";
import { LANGUAGE_OPTIONS } from "@/constants/i18n";
import { useGenderOptions } from "@/hooks/use-gender-options";
import { useFieldError } from "@/hooks/use-field-error";
import { ToggleRow } from "@/components/dashboard/toggle-row";
import type { ContactStatus } from "@/types/contact";
import type { FormAction, FormState } from "./form-state";

/**
 * Everything a contact is, as fields.
 *
 * The page keeps the submit and the row it writes; this is the part somebody
 * fills in, and it was most of the file.
 */
export function ContactFields({
  state,
  dispatch,
}: {
  state: FormState;
  dispatch: Dispatch<FormAction>;
}) {
  const t = useTranslations("dashboard.contacts.form");
  const tNewsletter = useTranslations("dashboard.contacts.detail.newsletter");
  const genderOptions = useGenderOptions();
  const fieldError = useFieldError();
  const {
    submitting,
    fieldErrors,
    firstName,
    lastName,
    email,
    phone,
    language,
    birthdate,
    gender,
    status,
    newsletter,
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
            htmlFor="status"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("fields.type")}
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) =>
              dispatch({
                type: "SET_STATUS",
                status: e.target.value as ContactStatus,
              })
            }
            disabled={submitting}
            className={INPUT_CLASS}
          >
            <option value="lead">{t("typeOptions.lead")}</option>
            <option value="client">{t("typeOptions.client")}</option>
            <option value="member">{t("typeOptions.member")}</option>
          </select>
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
              dispatch({
                type: "SET_FIELD",
                field: "language",
                value: next,
              })
            }
            disabled={submitting}
            ariaLabel={t("fields.preferredLanguage")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="birthdate"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("fields.birthdate")}
          </label>
          <input
            id="birthdate"
            type="date"
            value={birthdate}
            onChange={(e) =>
              dispatch({
                type: "SET_FIELD",
                field: "birthdate",
                value: e.target.value,
              })
            }
            disabled={submitting}
            className={INPUT_CLASS}
          />
        </div>

        <ToggleRow
          checked={newsletter}
          disabled={submitting}
          label={tNewsletter("label")}
          hint={t("newsletterHelp")}
          onToggle={() => dispatch({ type: "TOGGLE_NEWSLETTER" })}
        />
      </div>
    </div>
  );
}
