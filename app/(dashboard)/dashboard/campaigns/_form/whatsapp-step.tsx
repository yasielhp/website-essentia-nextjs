"use client";

import { whatsappTemplatesHref } from "@/lib/messages/message-route";
import { useEffect, useMemo, useState, type Dispatch } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { OptionSelect, type SelectOption } from "@/components/ui/option-select";
import { WhatsAppParamRow } from "@/components/dashboard/whatsapp-param-mapper";
import { useFieldError } from "@/hooks/use-field-error";
import { sendLocaleOf } from "@/lib/schemas";
import { campaignTemplateChoiceIssue } from "@/lib/campaigns/whatsapp-eligibility";
import {
  PARAM_FIELDS,
  fieldAvailable,
  fitParams,
  partitionTemplates,
  sampleParams,
} from "@/lib/campaigns/whatsapp-form";
import type { WhatsAppParamSource } from "@/lib/whatsapp/types";
import type { CampaignLocale } from "@/types/campaign";
import { TemplatePreview } from "@/components/dashboard/template-preview";
import type { FormAction, FormState } from "./form-state";
import type { TemplatesState } from "./use-whatsapp-templates";

const LOCALES: CampaignLocale[] = ["es", "en"];

/**
 * What a WhatsApp campaign says: which approved template goes out, and where
 * each of its `{{n}}` comes from. There is no text to write here, because the
 * words are the template's and Meta already approved them.
 *
 * Only templates that can really be sent are offered, in the language the
 * campaign goes out in; the rest are counted and explained so a missing one
 * is never a mystery.
 */
export function WhatsAppStep({
  state,
  dispatch,
  templates,
  onRetryTemplates,
  onDone,
}: {
  state: FormState;
  dispatch: Dispatch<FormAction>;
  templates: TemplatesState;
  /** Reads the templates again, without leaving the form (a reload would lose it). */
  onRetryTemplates: () => void;
  /** Validates the choice and opens the review step. */
  onDone: () => void;
}) {
  const t = useTranslations("dashboard.campaigns.form.whatsapp");
  const tCommon = useTranslations("dashboard.common");
  const tUnsupported = useTranslations(
    "dashboard.messages.whatsapp.unsupported",
  );
  const fieldError = useFieldError();
  const { audience, fieldErrors, submitting, kind, trigger } = state;
  const sendLocale = sendLocaleOf(audience);
  const block = state.content.whatsapp;
  const params = useMemo(() => block?.params ?? [], [block]);
  // A sample date that does not move while the admin is typing.
  const [today] = useState(() => new Date());

  const all = templates.status === "ready" ? templates.templates : [];
  const choices = partitionTemplates(all, sendLocale, kind);
  const selected = all.find((tpl) => tpl.id === block?.templateId) ?? null;
  const selectedIssue =
    selected && templates.status === "ready"
      ? campaignTemplateChoiceIssue(selected, sendLocale, kind)
      : null;
  const usable = selected && !selectedIssue ? selected : null;

  // A draft saved with another number of parameters than the template has
  // (or a template re-chosen) comes back to the template's count, so what is
  // shown is what is saved.
  useEffect(() => {
    if (!usable) return;
    const fitted = fitParams(params, usable.param_count);
    if (fitted !== params) {
      dispatch({
        type: "SET_WHATSAPP",
        templateId: usable.id,
        params: fitted,
      });
    }
  }, [usable, params, dispatch]);

  const localeLabel = (value: CampaignLocale) =>
    value === "es" ? t("localeEs") : t("localeEn");

  const templateOptions: SelectOption<string>[] = choices.eligible.map(
    (tpl) => ({
      value: tpl.id,
      label: tpl.name,
      desc: tpl.body.length > 90 ? `${tpl.body.slice(0, 90)}…` : tpl.body,
    }),
  );

  function pick(id: string) {
    const tpl = all.find((candidate) => candidate.id === id);
    if (!tpl) return;
    dispatch({
      type: "SET_WHATSAPP",
      templateId: tpl.id,
      params: fitParams(params, tpl.param_count),
    });
  }

  function setParam(index: number, source: WhatsAppParamSource) {
    dispatch({
      type: "SET_WHATSAPP",
      templateId: block?.templateId ?? null,
      params: params.map((current, i) => (i === index ? source : current)),
    });
  }

  const excludedLines = Object.entries(choices.excluded).filter(
    ([, count]) => (count ?? 0) > 0,
  );
  const templateError = fieldError(fieldErrors["content.whatsapp.templateId"]);
  const paramsError = fieldError(fieldErrors["content.whatsapp.params"]);

  return (
    <div className="flex flex-col gap-4">
      <section className="border-sand-200 animate-fade-in-up rounded-2xl border bg-white p-6">
        <h2 className="text-petroleum-500 mb-1 text-sm font-semibold">
          {t("title")}
        </h2>
        <p className="text-petroleum-400 mb-4 text-xs">{t("intro")}</p>

        {templates.status === "ready" && !templates.configured && (
          <p
            role="status"
            className="mb-4 rounded-xl bg-yellow-50 px-4 py-3 text-xs text-yellow-800"
          >
            {t("notConfigured")}
          </p>
        )}

        {audience.language === "any" ? (
          <div className="mb-4 flex flex-col gap-1.5">
            <label
              htmlFor="campaign-whatsapp-locale"
              className="text-petroleum-500 text-xs font-medium"
            >
              {t("language")}
            </label>
            <OptionSelect
              id="campaign-whatsapp-locale"
              value={sendLocale}
              options={LOCALES.map((value) => ({
                value,
                label: localeLabel(value),
              }))}
              disabled={submitting}
              onChange={(value) =>
                dispatch({
                  type: "SET_AUDIENCE",
                  patch: { sendLocale: value },
                })
              }
            />
            <p className="text-petroleum-400 text-xs">
              {t(
                kind === "appointment"
                  ? "languageHintAppointment"
                  : "languageHint",
              )}
            </p>
          </div>
        ) : (
          <p className="bg-sand-50 text-petroleum-400 mb-4 rounded-xl px-4 py-3 text-xs">
            {t(kind === "appointment" ? "sentInAppointment" : "sentIn", {
              language: localeLabel(sendLocale),
            })}
          </p>
        )}

        {templates.status === "idle" || templates.status === "loading" ? (
          <div className="bg-sand-100 h-14 animate-pulse rounded-xl" />
        ) : templates.status === "error" ? (
          <div role="alert" className="flex flex-col items-start gap-2">
            <p className="text-xs text-red-600">{t("loadFailed")}</p>
            <Button variant="outline" size="sm" onClick={onRetryTemplates}>
              {tCommon("retry")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {choices.eligible.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="campaign-whatsapp-template"
                  className="text-petroleum-500 text-xs font-medium"
                >
                  {t("template")}
                </label>
                <OptionSelect
                  id="campaign-whatsapp-template"
                  value={usable?.id ?? ""}
                  options={templateOptions}
                  placeholder={t("templatePlaceholder")}
                  disabled={submitting}
                  onChange={pick}
                />
                {templateError && (
                  <p role="alert" className="text-xs text-red-600">
                    {templateError}
                  </p>
                )}
                {kind === "appointment" && (
                  <p className="text-petroleum-400 text-xs">
                    {t("appointmentCategoryHint")}
                  </p>
                )}
              </div>
            )}

            {selected && selectedIssue && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700"
              >
                {t("selectedUnavailable", {
                  reason: t(`issue.${selectedIssue}`),
                })}
              </p>
            )}

            {choices.eligible.length === 0 && (
              <div className="bg-sand-50 rounded-xl px-4 py-4">
                <p className="text-petroleum-700 text-sm font-medium">
                  {t("noneTitle")}
                </p>
                {templateError && (
                  <p role="alert" className="mt-1 text-xs text-red-600">
                    {templateError}
                  </p>
                )}
                {/* Another tab: leaving would lose the campaign half made. */}
                <Link
                  href={whatsappTemplatesHref()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-petroleum-700 mt-2 inline-block text-sm font-medium underline underline-offset-2"
                >
                  {t("create")} <span aria-hidden="true">↗</span>
                </Link>
              </div>
            )}

            {excludedLines.length > 0 && (
              <div className="text-petroleum-400 text-xs">
                <p className="font-medium">{t("excludedTitle")}</p>
                <ul className="mt-1 list-disc pl-4">
                  {excludedLines.map(([issue, count]) => (
                    <li key={issue}>
                      {t(`excluded.${issue}`, {
                        count: count ?? 0,
                        language: localeLabel(sendLocale),
                      })}
                    </li>
                  ))}
                </ul>
                {choices.unsupportedReasons.length > 0 && (
                  <ul className="mt-1 list-disc pl-8">
                    {choices.unsupportedReasons.map((reason) => (
                      <li key={reason}>{tUnsupported(reason)}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {usable && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
          <section className="border-sand-200 rounded-2xl border bg-white p-6">
            <h2 className="text-petroleum-500 mb-1 text-sm font-semibold">
              {t("paramsTitle")}
            </h2>
            <p className="text-petroleum-400 mb-4 text-xs">
              {t("paramsHint", { count: usable.param_count })}
            </p>
            {paramsError && (
              <p role="alert" className="mb-3 text-xs text-red-600">
                {paramsError}
              </p>
            )}

            <div className="flex flex-col gap-5">
              {params.map((source, index) => (
                <WhatsAppParamRow
                  key={index}
                  index={index}
                  idPrefix="campaign-whatsapp-param"
                  fields={PARAM_FIELDS}
                  unavailableText={t("unavailable")}
                  source={source}
                  example={usable.example_params?.[index]}
                  available={
                    source.kind !== "field" ||
                    fieldAvailable(source.field, kind, trigger)
                  }
                  error={fieldError(
                    fieldErrors[`content.whatsapp.params.${index}`],
                  )}
                  disabled={submitting}
                  onChange={(next) => setParam(index, next)}
                />
              ))}
            </div>
          </section>

          <aside className="border-sand-200 rounded-2xl border bg-white p-6 lg:sticky lg:top-4 lg:self-start">
            <h2 className="text-petroleum-500 mb-1 text-sm font-semibold">
              {t("preview")}
            </h2>
            <p className="text-petroleum-400 mb-3 text-xs">
              {t("previewNote")}
            </p>
            <TemplatePreview
              headerText={usable.header_text}
              body={usable.body}
              footerText={usable.footer_text}
              buttons={usable.buttons ?? []}
              examples={sampleParams(params, sendLocale, kind, trigger, today)}
            />
          </aside>
        </div>
      )}

      <div>
        <Button size="md" disabled={submitting || !usable} onClick={onDone}>
          {t("confirm")}
        </Button>
      </div>
    </div>
  );
}
