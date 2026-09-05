"use client";

import type { Dispatch } from "react";
import { useTranslations } from "next-intl";
import { INPUT_CLASS } from "@/constants/form-styles";
import { Button } from "@/components/ui/button";
import { useFieldError } from "@/hooks/use-field-error";
import type { FormAction, FormState } from "./form-state";

/** What to call it, once the kind is chosen. Enter or the button moves on. */
export function NameStep({
  state,
  dispatch,
  onDone,
}: {
  state: FormState;
  dispatch: Dispatch<FormAction>;
  onDone: () => void;
}) {
  const t = useTranslations("dashboard.campaigns.form");
  const fieldError = useFieldError();
  const error = fieldError(state.fieldErrors.name);

  return (
    <section className="border-sand-200 animate-fade-in-up rounded-2xl border bg-white p-6">
      <label
        htmlFor="campaign-name"
        className="text-petroleum-500 mb-4 block text-sm font-semibold"
      >
        {t("name")}
      </label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex flex-1 flex-col gap-1.5">
          <input
            id="campaign-name"
            type="text"
            autoFocus
            value={state.name}
            disabled={state.submitting}
            placeholder={t("namePlaceholder")}
            onChange={(e) =>
              dispatch({ type: "SET_NAME", value: e.target.value })
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onDone();
              }
            }}
            className={INPUT_CLASS}
          />
          {error ? (
            <p className="text-xs text-red-500">{error}</p>
          ) : (
            <p className="text-petroleum-400 text-xs">{t("nameHint")}</p>
          )}
        </div>
        <Button
          size="md"
          disabled={state.submitting || state.name.trim() === ""}
          onClick={onDone}
          className="shrink-0"
        >
          {t("continue")}
        </Button>
      </div>
    </section>
  );
}
