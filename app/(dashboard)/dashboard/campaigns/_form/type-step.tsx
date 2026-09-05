"use client";

import type { Dispatch } from "react";
import { useTranslations } from "next-intl";
import { INPUT_CLASS } from "@/constants/form-styles";
import { useFieldError } from "@/hooks/use-field-error";
import { IconCheckmark } from "@/components/ui/icons";
import {
  AVAILABLE_KINDS,
  type CampaignKind,
  type FormAction,
  type FormState,
} from "./form-state";

const KINDS: CampaignKind[] = [
  "standard",
  "automated",
  "autoresponder",
  "split",
  "dateBased",
];

/**
 * The first thing asked: what to call it, and what kind of send it is.
 *
 * Only the standard campaign exists today. The other kinds are shown greyed
 * out rather than hidden so the admin knows they are coming and does not go
 * looking for them somewhere else.
 */
export function TypeStep({
  state,
  dispatch,
}: {
  state: FormState;
  dispatch: Dispatch<FormAction>;
}) {
  const t = useTranslations("dashboard.campaigns");
  const fieldError = useFieldError();
  const nameError = fieldError(state.fieldErrors.name);

  return (
    <div className="flex flex-col gap-4">
      <section className="border-sand-200 rounded-2xl border bg-white p-6">
        <label
          htmlFor="campaign-name"
          className="text-petroleum-500 mb-2 block text-sm font-semibold"
        >
          {t("form.name")}
        </label>
        <input
          id="campaign-name"
          type="text"
          autoFocus
          value={state.name}
          disabled={state.submitting}
          placeholder={t("form.namePlaceholder")}
          onChange={(e) =>
            dispatch({ type: "SET_NAME", value: e.target.value })
          }
          className={`${INPUT_CLASS} text-base`}
        />
        <p className="text-petroleum-400 mt-2 text-xs">{t("form.nameHint")}</p>
        {nameError && <p className="mt-1 text-xs text-red-500">{nameError}</p>}
      </section>

      <section className="border-sand-200 rounded-2xl border bg-white p-6">
        <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
          {t("type.title")}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {KINDS.map((kind) => {
            const available = AVAILABLE_KINDS.includes(kind);
            const active = state.kind === kind;
            return (
              <button
                key={kind}
                type="button"
                disabled={!available || state.submitting}
                aria-pressed={active}
                onClick={() => dispatch({ type: "SET_KIND", kind })}
                className={[
                  "relative flex flex-col gap-1.5 rounded-2xl border p-5 text-left transition-colors",
                  active
                    ? "border-petroleum-700 bg-petroleum-50/60"
                    : "border-sand-200 bg-white",
                  available
                    ? "hover:border-petroleum-400 cursor-pointer"
                    : "cursor-not-allowed opacity-60",
                ].join(" ")}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-petroleum-700 text-sm font-semibold">
                    {t(`type.${kind}`)}
                  </span>
                  {active && (
                    <span className="bg-petroleum-700 flex size-5 items-center justify-center rounded-full text-white">
                      <IconCheckmark />
                    </span>
                  )}
                  {!available && (
                    <span className="bg-sand-100 text-petroleum-400 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap">
                      {t("type.comingSoon")}
                    </span>
                  )}
                </span>
                <span className="text-petroleum-400 text-xs leading-relaxed">
                  {t(`type.${kind}Desc`)}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
