"use client";

import type { Dispatch } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { MultiOptionSelect } from "@/components/ui/multi-option-select";
import { OptionSelect, type SelectOption } from "@/components/ui/option-select";
import type { CampaignLanguage } from "@/types/campaign";
import type { FormAction, FormState } from "./form-state";
import { SERVICE_OPTIONS } from "./audience-step";
import { useAudienceReach } from "./use-audience-reach";

/**
 * Who gets an appointment notice: the audience is the appointments, so there
 * are no segments, no booking filters and nobody picked by hand. What is left
 * is which services it is about (none picked = every service) and the language
 * of the clients. The count is of clients with the appointment notices on, and
 * it says so: it is not a count of appointments.
 */
export function AppointmentAudience({
  state,
  dispatch,
  onDone,
}: {
  state: FormState;
  dispatch: Dispatch<FormAction>;
  onDone: () => void;
}) {
  const t = useTranslations("dashboard.campaigns.audience");
  const ta = useTranslations("dashboard.campaigns.audience.appointment");
  const { audience, reach, submitting } = state;
  const counting = useAudienceReach(state, dispatch);

  const languageOptions: SelectOption<CampaignLanguage>[] = [
    { value: "any", label: t("languageAny") },
    { value: "es", label: t("languageEs") },
    { value: "en", label: t("languageEn") },
  ];

  return (
    <section className="border-sand-200 animate-fade-in-up rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        {ta("title")}
      </h2>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="campaign-services"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("services")}
          </label>
          <MultiOptionSelect
            id="campaign-services"
            value={audience.services}
            options={SERVICE_OPTIONS}
            placeholder={t("servicesPlaceholder")}
            disabled={submitting}
            onChange={(services) =>
              dispatch({ type: "SET_AUDIENCE", patch: { services } })
            }
          />
          <p id="campaign-services-help" className="text-petroleum-400 text-xs">
            {ta("servicesHelp")}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="campaign-appointment-language"
            className="text-petroleum-500 text-xs font-medium"
          >
            {ta("language")}
          </label>
          <OptionSelect
            id="campaign-appointment-language"
            value={audience.language}
            options={languageOptions}
            disabled={submitting}
            onChange={(language) =>
              dispatch({ type: "SET_AUDIENCE", patch: { language } })
            }
          />
          <p className="text-petroleum-400 text-xs">{ta("languageHint")}</p>
        </div>

        <div className="bg-petroleum-50 flex flex-col gap-2 rounded-xl px-4 py-3">
          <p
            aria-live="polite"
            className="text-petroleum-700 text-sm font-medium"
          >
            {reach && !counting ? (
              <>
                {ta("reach", { count: reach.count })}
                <span className="text-petroleum-400 font-normal">
                  {" · "}
                  {t("reachByLanguage", { en: reach.en, es: reach.es })}
                </span>
              </>
            ) : (
              "…"
            )}
          </p>
          <p className="text-petroleum-500 text-xs">{ta("note")}</p>
        </div>

        <p className="rounded-xl bg-yellow-50 px-4 py-3 text-xs text-yellow-800">
          {ta("panelNote")}
        </p>

        <div className="flex items-center justify-end gap-3">
          <Button size="md" disabled={submitting || counting} onClick={onDone}>
            {t("confirm")}
          </Button>
        </div>
      </div>
    </section>
  );
}
