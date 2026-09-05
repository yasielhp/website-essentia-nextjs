"use client";

import { type Dispatch } from "react";
import { useTranslations } from "next-intl";
import { INPUT_CLASS } from "@/constants/form-styles";
import { EmailInput } from "@/components/ui/email-input";
import { OptionSelect } from "@/components/ui/option-select";
import { useGenderOptions } from "@/hooks/use-gender-options";
import { ToggleRow } from "@/components/dashboard/toggle-row";
import { LANGUAGE_OPTIONS } from "@/constants/i18n";
import type { GenderValue } from "@/constants/gender";
import type { FormAction } from "./form-state";

/**
 * Who the appointment is for.
 *
 * Last of the steps, and shown only once there is an hour to attach the name
 * to — asking for it earlier is asking somebody to type a name into nothing.
 */
export function ClientStep({
  firstName,
  lastName,
  email,
  phone,
  gender,
  language,
  notes,
  newsletter,
  submitting,
  dispatchForm,
}: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: GenderValue;
  language: string;
  notes: string;
  newsletter: boolean;
  submitting: boolean;
  dispatchForm: Dispatch<FormAction>;
}) {
  const t = useTranslations("dashboard.bookings.form");
  const tNewsletter = useTranslations("dashboard.contacts.detail.newsletter");
  const tContactForm = useTranslations("dashboard.contacts.form");
  const genderOptions = useGenderOptions();

  return (
    <div className="border-sand-200 animate-fade-in-up rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        {t("steps.client")}
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
                dispatchForm({
                  type: "SET_FIELD",
                  field: "firstName",
                  value: e.target.value,
                })
              }
              placeholder={t("fields.firstNamePlaceholder")}
              disabled={submitting}
              className={INPUT_CLASS}
            />
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
                dispatchForm({
                  type: "SET_FIELD",
                  field: "lastName",
                  value: e.target.value,
                })
              }
              placeholder={t("fields.lastNamePlaceholder")}
              disabled={submitting}
              className={INPUT_CLASS}
            />
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
              dispatchForm({
                type: "SET_FIELD",
                field: "email",
                value: value,
              })
            }
            placeholder={t("fields.emailPlaceholder")}
            disabled={submitting}
            className={INPUT_CLASS}
          />
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
              dispatchForm({
                type: "SET_FIELD",
                field: "phone",
                value: e.target.value,
              })
            }
            placeholder={t("fields.phonePlaceholder")}
            disabled={submitting}
            className={INPUT_CLASS}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="client-gender"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("fields.gender")}
          </label>
          <OptionSelect
            id="client-gender"
            value={gender}
            options={genderOptions}
            onChange={(next) =>
              dispatchForm({
                type: "SET_FIELD",
                field: "gender",
                value: next,
              })
            }
            disabled={submitting}
            ariaLabel={t("fields.gender")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="client-language"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("fields.language")}
          </label>
          <OptionSelect
            id="client-language"
            value={language}
            options={LANGUAGE_OPTIONS}
            onChange={(next) =>
              dispatchForm({
                type: "SET_FIELD",
                field: "language",
                value: next,
              })
            }
            disabled={submitting}
            ariaLabel={t("fields.language")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="notes"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("fields.notes")}
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) =>
              dispatchForm({
                type: "SET_NOTES",
                value: e.target.value,
              })
            }
            placeholder={t("fields.notesPlaceholder")}
            rows={3}
            disabled={submitting}
            className={INPUT_CLASS + " resize-none"}
          />
        </div>

        <ToggleRow
          checked={newsletter}
          disabled={submitting}
          label={tNewsletter("label")}
          hint={tContactForm("newsletterHelp")}
          onToggle={() => dispatchForm({ type: "TOGGLE_NEWSLETTER" })}
        />
      </div>
    </div>
  );
}
