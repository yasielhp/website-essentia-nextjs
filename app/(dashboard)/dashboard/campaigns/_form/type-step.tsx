"use client";

import type { Dispatch } from "react";
import { useTranslations } from "next-intl";
import { INPUT_CLASS } from "@/constants/form-styles";
import { useFieldError } from "@/hooks/use-field-error";
import {
  IconCalendar,
  IconCheck,
  IconEdit,
  IconMail,
  IconSettings,
  IconWorld,
} from "@/components/ui/icons";
import {
  AVAILABLE_KINDS,
  type CampaignKind,
  type FormAction,
  type FormState,
} from "./form-state";

const KINDS: { kind: CampaignKind; icon: React.ReactNode }[] = [
  { kind: "standard", icon: <IconMail /> },
  { kind: "automated", icon: <IconSettings /> },
  { kind: "autoresponder", icon: <IconCheck /> },
  { kind: "split", icon: <IconEdit /> },
  { kind: "rss", icon: <IconWorld /> },
  { kind: "dateBased", icon: <IconCalendar /> },
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
  onDone,
}: {
  state: FormState;
  dispatch: Dispatch<FormAction>;
  /** Called when a kind is chosen; the shell checks the name and moves on. */
  onDone: () => void;
}) {
  const t = useTranslations("dashboard.campaigns");
  const fieldError = useFieldError();
  const nameError = fieldError(state.fieldErrors.name);

  return (
    <div className="border-sand-200 mx-auto w-full max-w-5xl rounded-2xl border bg-white px-6 py-10 lg:px-12">
      <section className="mx-auto flex max-w-3xl flex-col items-center gap-3 text-center">
        <label
          htmlFor="campaign-name"
          className="font-display text-petroleum-700 text-2xl"
        >
          {t("form.name")}
        </label>
        <p className="text-petroleum-400 text-sm">{t("form.nameHint")}</p>
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
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onDone();
            }
          }}
          className={`${INPUT_CLASS} mt-2 text-base`}
        />
        {nameError && <p className="text-xs text-red-500">{nameError}</p>}
      </section>

      <hr className="border-sand-200 my-10" />

      <section className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <h2 className="font-display text-petroleum-700 text-2xl">
            {t("type.title")}
          </h2>
          <p className="text-petroleum-400 text-sm">{t("type.hint")}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {KINDS.map(({ kind, icon }) => {
            const available = AVAILABLE_KINDS.includes(kind);
            const active = state.kind === kind;
            return (
              <button
                key={kind}
                type="button"
                disabled={!available || state.submitting}
                aria-pressed={active}
                onClick={() => {
                  dispatch({ type: "SET_KIND", kind });
                  onDone();
                }}
                className={[
                  "flex items-start gap-4 rounded-2xl border p-5 text-left transition-colors",
                  active
                    ? "border-petroleum-700 bg-petroleum-50/50 ring-petroleum-100 ring-2"
                    : "border-sand-200 bg-white",
                  available
                    ? "hover:border-petroleum-400 cursor-pointer"
                    : "cursor-not-allowed opacity-55",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex size-12 shrink-0 items-center justify-center rounded-xl [&_svg]:size-6",
                    active
                      ? "bg-petroleum-700 text-white"
                      : "bg-sand-100 text-petroleum-500",
                  ].join(" ")}
                >
                  {icon}
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-petroleum-700 text-sm font-semibold">
                      {t(`type.${kind}`)}
                    </span>
                    {!available && (
                      <span className="bg-sand-100 text-petroleum-400 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap">
                        {t("type.comingSoon")}
                      </span>
                    )}
                  </span>
                  <span className="text-petroleum-400 text-xs leading-relaxed">
                    {t(`type.${kind}Desc`)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
