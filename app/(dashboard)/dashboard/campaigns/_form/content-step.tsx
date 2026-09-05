"use client";

import { useMemo, useRef, type Dispatch } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import "@maily-to/core/style.css";
import { INPUT_CLASS } from "@/constants/form-styles";
import { Button } from "@/components/ui/button";
import { OptionSelect, type SelectOption } from "@/components/ui/option-select";
import { useFieldError } from "@/hooks/use-field-error";
import { sendLocaleOf } from "@/lib/schemas";
import { emptyDoc } from "@/lib/campaigns/doc";
import type {
  CampaignLocale,
  CampaignLocaleContent,
  EmailDoc,
} from "@/types/campaign";
import { EmailPreview } from "./email-preview";
import type { FormAction, FormState } from "./form-state";

// The editor is a browser-only thing (ProseMirror needs a DOM); it is loaded
// after the page, with a placeholder the height it will take.
const MailyEditor = dynamic(
  () => import("@maily-to/core").then((mod) => mod.Editor),
  {
    ssr: false,
    loading: () => (
      <div className="bg-sand-100 min-h-96 animate-pulse rounded-2xl" />
    ),
  },
);

const LIMITS: Partial<Record<keyof CampaignLocaleContent, number>> = {
  subject: 120,
  preheader: 150,
};

/**
 * What the email says: subject line, title, and the body in a Maily editor —
 * type, press `/` for a block (button, image, divider, columns…), select text
 * for the formatting bar. One language only, decided by the segment (or by
 * the dropdown when the segment spans both). The preview below is drawn by
 * the sending template.
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
  const { content, audience, fieldErrors, submitting } = state;
  const locale = sendLocaleOf(audience);
  const block = content[locale];
  const localeOptions: SelectOption<CampaignLocale>[] = [
    { value: "es", label: t("localeEs") },
    { value: "en", label: t("localeEn") },
  ];
  const localeLabel = (value: CampaignLocale) =>
    value === "es" ? t("localeEs") : t("localeEn");

  const set =
    (field: Exclude<keyof CampaignLocaleContent, "doc">) => (value: string) =>
      dispatch({ type: "SET_CONTENT", locale, field, value });

  const errorFor = (path: string) =>
    fieldError(fieldErrors[`content.${locale}.${path}`]);

  // The editor owns its document while typing; the form is told about it a
  // beat after the last keystroke, so a fast sentence is one state update.
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialDoc = useMemo(
    () => (block.doc as EmailDoc | null) ?? emptyDoc(),
    // Only when the language changes: a fresh editor for a fresh document.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale],
  );

  const textField = (
    name: Exclude<keyof CampaignLocaleContent, "doc">,
    label: string,
    hint?: string,
  ) => {
    const limit = LIMITS[name];
    const error = errorFor(name);
    const id = `campaign-${locale}-${name}`;
    const value = block[name] ?? "";
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
                value.length > limit ? "text-red-500" : "text-petroleum-400"
              }`}
            >
              {t("characters", { count: value.length, max: limit })}
            </span>
          )}
        </div>
        <input
          id={id}
          type="text"
          value={value}
          disabled={submitting}
          onChange={(e) => set(name)(e.target.value)}
          className={INPUT_CLASS}
        />
        {hint && !error && <p className="text-petroleum-400 text-xs">{hint}</p>}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  };

  const docError = errorFor("doc");

  return (
    <div className="flex flex-col gap-4">
      <section className="border-sand-200 animate-fade-in-up rounded-2xl border bg-white p-6">
        <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
          {t("title")}
        </h2>

        {audience.language === "any" ? (
          <div className="mb-4 flex flex-col gap-1.5">
            <label
              htmlFor="campaign-send-locale"
              className="text-petroleum-500 text-xs font-medium"
            >
              {t("emailLanguage")}
            </label>
            <OptionSelect
              id="campaign-send-locale"
              value={locale}
              options={localeOptions}
              disabled={submitting}
              onChange={(sendLocale) =>
                dispatch({ type: "SET_AUDIENCE", patch: { sendLocale } })
              }
            />
            <p className="text-petroleum-400 text-xs">
              {t("emailLanguageHint")}
            </p>
          </div>
        ) : (
          <p className="bg-sand-50 text-petroleum-400 mb-4 rounded-xl px-4 py-3 text-xs">
            {t("sentIn", { language: localeLabel(locale) })}
          </p>
        )}

        <div className="flex flex-col gap-4">
          {textField(
            "subject",
            state.kind === "split" ? t("subjectA") : t("subject"),
          )}
          {state.kind === "split" &&
            textField("subjectB", t("subjectB"), t("subjectBHint"))}
          {textField("preheader", t("preheader"), t("preheaderHint"))}
          {textField("title", t("emailTitle"))}
        </div>
      </section>

      <section className="border-sand-200 rounded-2xl border bg-white p-6">
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <h2 className="text-petroleum-500 text-sm font-semibold">
            {t("body")}
          </h2>
          {docError && <p className="text-xs text-red-500">{docError}</p>}
        </div>
        <p className="text-petroleum-400 mb-4 text-xs">{t("bodyHint")}</p>

        <div className="border-sand-200 rounded-2xl border px-4 py-2">
          <MailyEditor
            key={locale}
            contentJson={initialDoc as never}
            editable={!submitting}
            config={{
              hasMenuBar: false,
              spellCheck: true,
              autofocus: false,
              immediatelyRender: false,
              contentClassName: "min-h-80",
            }}
            onUpdate={(editor) => {
              if (pending.current) clearTimeout(pending.current);
              pending.current = setTimeout(() => {
                dispatch({
                  type: "SET_DOC",
                  locale,
                  doc: editor.getJSON() as EmailDoc,
                });
              }, 300);
            }}
          />
        </div>

        <div className="flex justify-end pt-6">
          <Button size="md" disabled={submitting} onClick={onDone}>
            {t("confirm")}
          </Button>
        </div>
      </section>

      <section className="border-sand-200 rounded-2xl border bg-white p-6">
        <EmailPreview content={block} locale={locale} />
      </section>
    </div>
  );
}
