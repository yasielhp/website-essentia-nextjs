"use client";

import { type Dispatch } from "react";
import { useTranslations } from "next-intl";
import { INPUT_CLASS } from "@/constants/form-styles";
import { EmailInput } from "@/components/ui/email-input";
import { OptionSelect, type SelectOption } from "@/components/ui/option-select";
import { useGenderOptions } from "@/hooks/use-gender-options";
import { LANGUAGE_OPTIONS } from "@/constants/i18n";
import {
  ROLE_VALUES,
  type Action,
  type State,
  type SystemRole,
} from "./form-state";

/**
 * Which role this person holds, and everything else about them.
 *
 * Two cards, two hundred and thirty lines, in the page that also loads the
 * profile, saves it, changes the password and connects a calendar.
 */
export function UserFields({
  state,
  dispatch,
}: {
  state: State;
  dispatch: Dispatch<Action>;
}) {
  const t = useTranslations("dashboard.users.detail");
  const tForm = useTranslations("dashboard.users.form");
  const genderOptions = useGenderOptions();
  const roles: SelectOption<SystemRole>[] = ROLE_VALUES.map((value) => ({
    value,
    label: tForm(`roles.${value}.label`),
    desc: tForm(`roles.${value}.desc`),
  }));
  const { loading, saving } = state;

  return (
    <>
      {/* Role */}
      <div className="border-sand-200 rounded-2xl border bg-white p-6">
        <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
          {t("sections.role")}
        </h2>
        {loading ? (
          <div className="bg-sand-100 h-20 animate-pulse rounded-xl" />
        ) : (
          <OptionSelect
            id="role"
            value={state.role}
            options={roles}
            onChange={(nextRole) =>
              dispatch({ type: "SET_ROLE", role: nextRole })
            }
            disabled={saving}
            ariaLabel={tForm("fields.role")}
          />
        )}
      </div>

      {/* Details */}
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
                {tForm("fields.firstName")}{" "}
                <span className="text-red-400">*</span>
              </label>
              {loading ? (
                <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
              ) : (
                <input
                  id="firstName"
                  type="text"
                  value={state.firstName}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_FIELD",
                      field: "firstName",
                      value: e.target.value,
                    })
                  }
                  disabled={saving}
                  className={INPUT_CLASS}
                />
              )}
              {state.fieldErrors.firstName && (
                <p className="text-xs text-red-500">
                  {state.fieldErrors.firstName}
                </p>
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
                  value={state.lastName}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_FIELD",
                      field: "lastName",
                      value: e.target.value,
                    })
                  }
                  disabled={saving}
                  className={INPUT_CLASS}
                />
              )}
              {state.fieldErrors.lastName && (
                <p className="text-xs text-red-500">
                  {state.fieldErrors.lastName}
                </p>
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
                value={state.email}
                onChange={(value) =>
                  dispatch({
                    type: "SET_FIELD",
                    field: "email",
                    value: value,
                  })
                }
                disabled={saving}
                className={INPUT_CLASS}
              />
            )}
            {state.fieldErrors.email && (
              <p className="text-xs text-red-500">{state.fieldErrors.email}</p>
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
                value={state.phone}
                onChange={(e) =>
                  dispatch({
                    type: "SET_FIELD",
                    field: "phone",
                    value: e.target.value,
                  })
                }
                disabled={saving}
                className={INPUT_CLASS}
              />
            )}
            {state.fieldErrors.phone && (
              <p className="text-xs text-red-500">{state.fieldErrors.phone}</p>
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
                value={state.gender}
                options={genderOptions}
                onChange={(next) =>
                  dispatch({ type: "SET_GENDER", gender: next })
                }
                disabled={saving}
                ariaLabel={tForm("fields.gender")}
              />
            )}
          </div>

          {/* Only staff hold a job title: it names what they do. */}
          {state.role === "staff" && (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="job-title"
                className="text-petroleum-500 text-xs font-medium"
              >
                {tForm("fields.jobTitle")}
              </label>
              {loading ? (
                <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
              ) : (
                <input
                  id="job-title"
                  type="text"
                  value={state.jobTitle}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_FIELD",
                      field: "jobTitle",
                      value: e.target.value,
                    })
                  }
                  placeholder={tForm("fields.jobTitlePlaceholder")}
                  disabled={saving}
                  className={INPUT_CLASS}
                />
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="language"
              className="text-petroleum-500 text-xs font-medium"
            >
              {tForm("fields.preferredLanguage")}
            </label>
            {loading ? (
              <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
            ) : (
              <OptionSelect
                id="language"
                value={state.language}
                options={LANGUAGE_OPTIONS}
                onChange={(next) =>
                  dispatch({ type: "SET_LANGUAGE", language: next })
                }
                disabled={saving}
                ariaLabel={t("fields.preferredLanguage")}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
