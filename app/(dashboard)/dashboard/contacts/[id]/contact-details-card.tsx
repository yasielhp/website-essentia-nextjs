"use client";

import { useTranslations } from "next-intl";
import { ToggleRow } from "@/components/dashboard/toggle-row";
import { OptionSelect } from "@/components/ui/option-select";
import { EmailInput } from "@/components/ui/email-input";
import { useGenderOptions } from "@/hooks/use-gender-options";
import { LANGUAGE_OPTIONS } from "@/constants/i18n";
import type { GenderValue } from "@/constants/gender";
import type { ContactErrors, FormAction } from "./form-state";

const INPUT_CLASS =
  "border-sand-200 bg-white text-petroleum-700 placeholder:text-petroleum-400 focus:border-petroleum-400 focus:ring-petroleum-100 rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 w-full disabled:opacity-60";

export function ContactDetailsCard({
  firstName,
  lastName,
  email,
  phone,
  language,
  birthdate,
  gender,
  newsletterSubscribed,
  fieldErrors,
  loading,
  saving,
  dispatchForm,
}: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  language: string;
  birthdate: string;
  gender: GenderValue;
  newsletterSubscribed: boolean;
  fieldErrors: ContactErrors;
  loading: boolean;
  saving: boolean;
  dispatchForm: React.Dispatch<FormAction>;
}) {
  const t = useTranslations("dashboard.contacts.detail");
  const tForm = useTranslations("dashboard.contacts.form");
  const genderOptions = useGenderOptions();
  function field(
    f: "firstName" | "lastName" | "email" | "phone" | "language" | "birthdate",
    value: string,
  ) {
    dispatchForm({ type: "SET_FIELD", field: f, value });
  }

  return (
    <div className="border-sand-200 mb-6 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">Details</h2>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="firstName"
              className="text-petroleum-500 text-xs font-medium"
            >
              {tForm("fields.firstName")}{" "}
              <span className="text-red-400">*</span>
            </label>
            {loading ? (
              <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
            ) : (
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => field("firstName", e.target.value)}
                placeholder={tForm("fields.firstNamePlaceholder")}
                disabled={saving}
                className={INPUT_CLASS}
              />
            )}
            {fieldErrors.firstName && (
              <p className="text-xs text-red-500">{fieldErrors.firstName}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="lastName"
              className="text-petroleum-500 text-xs font-medium"
            >
              {tForm("fields.lastName")}
            </label>
            {loading ? (
              <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
            ) : (
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => field("lastName", e.target.value)}
                placeholder={tForm("fields.lastNamePlaceholder")}
                disabled={saving}
                className={INPUT_CLASS}
              />
            )}
            {fieldErrors.lastName && (
              <p className="text-xs text-red-500">{fieldErrors.lastName}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email"
            className="text-petroleum-500 text-xs font-medium"
          >
            {tForm("fields.email")}
          </label>
          {loading ? (
            <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
          ) : (
            <EmailInput
              id="email"
              value={email}
              onChange={(value) => field("email", value)}
              placeholder={tForm("fields.emailPlaceholder")}
              disabled={saving}
              className={INPUT_CLASS}
            />
          )}
          {fieldErrors.email && (
            <p className="text-xs text-red-500">{fieldErrors.email}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="phone"
            className="text-petroleum-500 text-xs font-medium"
          >
            {tForm("fields.phone")}
          </label>
          {loading ? (
            <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
          ) : (
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => field("phone", e.target.value)}
              placeholder={tForm("fields.phonePlaceholder")}
              disabled={saving}
              className={INPUT_CLASS}
            />
          )}
          {fieldErrors.phone && (
            <p className="text-xs text-red-500">{fieldErrors.phone}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="gender"
            className="text-petroleum-500 text-xs font-medium"
          >
            {tForm("fields.gender")}
          </label>
          {loading ? (
            <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
          ) : (
            <OptionSelect
              id="gender"
              value={gender}
              options={genderOptions}
              onChange={(next) =>
                dispatchForm({ type: "SET_GENDER", gender: next })
              }
              disabled={saving}
              ariaLabel={tForm("fields.gender")}
            />
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="language"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("fields.preferredLanguage")}
          </label>
          {loading ? (
            <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
          ) : (
            <OptionSelect
              id="language"
              value={language}
              options={LANGUAGE_OPTIONS}
              onChange={(next) => field("language", next)}
              disabled={saving}
              ariaLabel={t("fields.preferredLanguage")}
            />
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="birthdate"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("fields.birthdate")}
          </label>
          {loading ? (
            <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
          ) : (
            <input
              id="birthdate"
              type="date"
              value={birthdate}
              onChange={(e) => field("birthdate", e.target.value)}
              disabled={saving}
              className={INPUT_CLASS}
            />
          )}
        </div>

        {loading ? (
          <div className="bg-sand-100 h-16 animate-pulse rounded-2xl" />
        ) : (
          <ToggleRow
            checked={newsletterSubscribed}
            disabled={saving}
            label={t("newsletter.label")}
            hint={
              newsletterSubscribed
                ? t("newsletter.subscribed")
                : t("newsletter.notSubscribed")
            }
            onToggle={() => dispatchForm({ type: "TOGGLE_NEWSLETTER" })}
          />
        )}
      </div>
    </div>
  );
}
