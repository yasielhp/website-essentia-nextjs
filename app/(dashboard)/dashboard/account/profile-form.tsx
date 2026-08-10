"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { INPUT_CLASS } from "@/constants/form-styles";
import type { Dispatch } from "react";
import type { PageAction, PageState } from "./state";

/**
 * Name, phone and language — the part of the account that is a form.
 *
 * It reads the page's state and dispatches back to it rather than holding its
 * own: these fields are saved together with the avatar the sidebar edits, so
 * one reducer owns the row and this is the view over it.
 */
export function ProfileForm({
  state,
  dispatch,
  email,
  onSubmit,
}: {
  state: PageState;
  dispatch: Dispatch<PageAction>;
  /** Shown read-only: the address is changed from the users screen, not here. */
  email: string;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const t = useTranslations("dashboard.account");
  const tUsers = useTranslations("dashboard.users.form");
  const { loading, saving, error, firstName, lastName, phone, language } =
    state;

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="border-sand-200 rounded-2xl border bg-white p-6">
        <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
          {t("sections.profile")}
        </h2>

        {error && (
          <p className="mb-4 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="firstName"
                className="text-petroleum-500 text-xs font-medium"
              >
                {tUsers("fields.firstName")}{" "}
                <span className="text-red-400">*</span>
              </label>
              {loading ? (
                <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
              ) : (
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_FIRST_NAME",
                      value: e.target.value,
                    })
                  }
                  placeholder={tUsers("fields.firstNamePlaceholder")}
                  disabled={saving}
                  className={INPUT_CLASS}
                />
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="lastName"
                className="text-petroleum-500 text-xs font-medium"
              >
                {tUsers("fields.lastName")}
              </label>
              {loading ? (
                <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
              ) : (
                <input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_LAST_NAME",
                      value: e.target.value,
                    })
                  }
                  placeholder={tUsers("fields.lastNamePlaceholder")}
                  disabled={saving}
                  className={INPUT_CLASS}
                />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-petroleum-500 text-xs font-medium"
            >
              {tUsers("fields.email")}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              disabled
              readOnly
              className={INPUT_CLASS}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="phone"
              className="text-petroleum-500 text-xs font-medium"
            >
              {tUsers("fields.phone")}
            </label>
            {loading ? (
              <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
            ) : (
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) =>
                  dispatch({ type: "SET_PHONE", value: e.target.value })
                }
                placeholder={tUsers("fields.phonePlaceholder")}
                disabled={saving}
                className={INPUT_CLASS}
              />
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="language"
              className="text-petroleum-500 text-xs font-medium"
            >
              {t("preferredLanguage")}
            </label>
            {loading ? (
              <div className="bg-sand-100 h-11 animate-pulse rounded-xl" />
            ) : (
              <select
                id="language"
                value={language}
                onChange={(e) =>
                  dispatch({
                    type: "SET_LANGUAGE",
                    value: e.target.value,
                  })
                }
                disabled={saving}
                className={INPUT_CLASS}
              >
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
            )}
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <Button
            type="submit"
            variant="solid"
            size="md"
            disabled={saving || loading}
            className="gap-1.5"
          >
            {saving ? t("saving") : t("saveChanges")}
          </Button>
        </div>
      </div>
    </form>
  );
}
