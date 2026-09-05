"use client";

import type { Dispatch } from "react";
import { useTranslations } from "next-intl";
import { INPUT_CLASS, TEXTAREA_CLASS } from "@/constants/form-styles";
import { ImageUpload } from "@/components/ui/image-upload";
import { Button } from "@/components/ui/button";
import { TabButton } from "@/components/dashboard/settings/tab-button";
import { useFieldError } from "@/hooks/use-field-error";
import { requiredLocales } from "@/lib/schemas";
import type { CampaignLocale, CampaignLocaleContent } from "@/types/campaign";
import { EmailPreview } from "./email-preview";
import type { FormAction, FormState } from "./form-state";

const LIMITS: Partial<Record<keyof CampaignLocaleContent, number>> = {
  subject: 120,
  preheader: 150,
  ctaText: 60,
};

/**
 * What the email says, in the languages the audience step asked for.
 *
 * The form on the left, the rendered email on the right; the two never get
 * out of step because the preview is drawn from the same values.
 */
export function ContentStep({
  state,
  dispatch,
  onDone,
}: {
  state: FormState;
  dispatch: Dispatch<FormAction>;
  /** Validates the copy and opens the review step. */
  onDone: () => void;
}) {
  const t = useTranslations("dashboard.campaigns.content");
  const fieldError = useFieldError();
  const { activeLocale, content, audience, fieldErrors, submitting } = state;
  const locales = requiredLocales(audience.language);
  const editable = locales.includes(activeLocale);
  const block = content[activeLocale];

  const set = (field: keyof CampaignLocaleContent) => (value: string) =>
    dispatch({ type: "SET_CONTENT", locale: activeLocale, field, value });

  const errorFor = (field: keyof CampaignLocaleContent) =>
    fieldError(fieldErrors[`content.${activeLocale}.${field}`]);

  const localeLabel = (locale: CampaignLocale) =>
    locale === "es" ? t("localeEs") : t("localeEn");

  const field = (
    name: keyof CampaignLocaleContent,
    label: string,
    options: { textarea?: boolean; hint?: string; placeholder?: string } = {},
  ) => {
    const limit = LIMITS[name];
    const error = errorFor(name);
    const id = `campaign-${activeLocale}-${name}`;
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <label
            htmlFor={id}
            className="text-petroleum-500 text-xs font-medium"
          >
            {label}
          </label>
          {limit && (
            <span
              className={`text-xs ${
                block[name].length > limit
                  ? "text-red-500"
                  : "text-petroleum-400"
              }`}
            >
              {t("characters", { count: block[name].length, max: limit })}
            </span>
          )}
        </div>
        {options.textarea ? (
          <textarea
            id={id}
            value={block[name]}
            rows={10}
            disabled={submitting || !editable}
            placeholder={options.placeholder}
            onChange={(e) => set(name)(e.target.value)}
            className={`${TEXTAREA_CLASS} min-h-60 font-mono text-[13px] leading-relaxed`}
          />
        ) : (
          <input
            id={id}
            type="text"
            value={block[name]}
            disabled={submitting || !editable}
            placeholder={options.placeholder}
            onChange={(e) => set(name)(e.target.value)}
            className={INPUT_CLASS}
          />
        )}
        {options.hint && !error && (
          <p className="text-petroleum-400 text-xs">{options.hint}</p>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="border-sand-200 rounded-2xl border bg-white p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-petroleum-500 text-sm font-semibold">
            {t("title")}
          </h2>
          <div className="flex gap-1">
            {(["es", "en"] as CampaignLocale[]).map((locale) => (
              <TabButton
                key={locale}
                active={activeLocale === locale}
                onClick={() => dispatch({ type: "SET_LOCALE", locale })}
              >
                {localeLabel(locale)}
                {Object.keys(fieldErrors).some((k) =>
                  k.startsWith(`content.${locale}.`),
                ) && <span className="ml-1 text-red-400">•</span>}
              </TabButton>
            ))}
          </div>
        </div>

        {!editable && (
          <p className="bg-sand-50 text-petroleum-400 mb-4 rounded-xl px-4 py-3 text-sm">
            {t("notSentIn", { language: localeLabel(activeLocale) })}
          </p>
        )}

        <div className="flex flex-col gap-4">
          {field("subject", t("subject"))}
          {field("preheader", t("preheader"), { hint: t("preheaderHint") })}
          {field("title", t("emailTitle"))}
          {field("body", t("body"), { textarea: true, hint: t("bodyHelp") })}

          <div className="flex flex-col gap-1.5">
            <span className="text-petroleum-500 text-xs font-medium">
              {t("image")}
            </span>
            <ImageUpload
              bucket="campaigns"
              folder="images"
              value={block.imageUrl}
              onChange={set("imageUrl")}
            />
            <input
              type="url"
              value={block.imageUrl}
              disabled={submitting || !editable}
              placeholder={t("imageUrl")}
              aria-label={t("imageUrl")}
              onChange={(e) => set("imageUrl")(e.target.value)}
              className={INPUT_CLASS}
            />
            {errorFor("imageUrl") && (
              <p className="text-xs text-red-500">{errorFor("imageUrl")}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {field("ctaText", t("ctaText"))}
            {field("ctaUrl", t("ctaUrl"), { placeholder: "https://" })}
          </div>

          <div className="flex justify-end pt-2">
            <Button size="md" disabled={submitting} onClick={onDone}>
              {t("confirm")}
            </Button>
          </div>
        </div>
      </section>

      <section className="border-sand-200 rounded-2xl border bg-white p-6">
        <EmailPreview content={block} locale={activeLocale} />
      </section>
    </div>
  );
}
