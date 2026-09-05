"use client";

import { useRef, type Dispatch } from "react";
import { useTranslations } from "next-intl";
import { INPUT_CLASS, TEXTAREA_CLASS } from "@/constants/form-styles";
import { ImageUpload } from "@/components/ui/image-upload";
import { Button } from "@/components/ui/button";
import { OptionSelect, type SelectOption } from "@/components/ui/option-select";
import {
  IconChevronDown,
  IconEdit,
  IconImage,
  IconMinus,
  IconPlus,
  IconTrash,
  IconUserCircle,
} from "@/components/ui/icons";
import { useFieldError } from "@/hooks/use-field-error";
import { sendLocaleOf } from "@/lib/schemas";
import type {
  CampaignLocale,
  CampaignLocaleContent,
  ContentBlock,
  ContentBlockType,
} from "@/types/campaign";
import { EmailPreview } from "./email-preview";
import type { FormAction, FormState } from "./form-state";

const LIMITS: Partial<Record<keyof CampaignLocaleContent, number>> = {
  subject: 120,
  preheader: 150,
};

const BLOCK_TYPES: ContentBlockType[] = [
  "paragraph",
  "heading",
  "image",
  "button",
  "divider",
];

function emptyBlock(type: ContentBlockType): ContentBlock {
  switch (type) {
    case "paragraph":
      return { type, text: "" };
    case "heading":
      return { type, text: "" };
    case "image":
      return { type, url: "", alt: "" };
    case "button":
      return { type, text: "", url: "" };
    case "divider":
      return { type };
  }
}

/**
 * What the email says: subject line, title, and the body as a stack of blocks
 * the admin adds, edits, reorders and removes — the way a page builder works,
 * kept to the five things an email client renders reliably.
 *
 * One language only, decided by the segment (or by the dropdown when the
 * segment spans both). The preview below is drawn by the sending template.
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
  const tBlocks = useTranslations("dashboard.campaigns.content.blocks");
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
    (field: Exclude<keyof CampaignLocaleContent, "blocks">) =>
    (value: string) =>
      dispatch({ type: "SET_CONTENT", locale, field, value });

  const errorFor = (path: string) =>
    fieldError(fieldErrors[`content.${locale}.${path}`]);

  const textField = (
    name: Exclude<keyof CampaignLocaleContent, "blocks">,
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

  const blocksError = errorFor("blocks");

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
          {textField("subject", t("subject"))}
          {textField("preheader", t("preheader"), t("preheaderHint"))}
          {textField("title", t("emailTitle"))}
        </div>
      </section>

      <section className="border-sand-200 rounded-2xl border bg-white p-6">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="text-petroleum-500 text-sm font-semibold">
            {tBlocks("title")}
          </h2>
          {blocksError && <p className="text-xs text-red-500">{blocksError}</p>}
        </div>

        {block.blocks.length === 0 ? (
          <p className="bg-sand-50 text-petroleum-400 rounded-xl px-4 py-6 text-center text-sm">
            {tBlocks("empty")}
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {block.blocks.map((item, index) => (
              <BlockEditor
                key={index}
                index={index}
                total={block.blocks.length}
                block={item}
                disabled={submitting}
                error={
                  Object.entries(fieldErrors).find(([key]) =>
                    key.startsWith(`content.${locale}.blocks.${index}.`),
                  )?.[1]
                }
                onChange={(next) =>
                  dispatch({ type: "UPDATE_BLOCK", locale, index, block: next })
                }
                onMove={(direction) =>
                  dispatch({ type: "MOVE_BLOCK", locale, index, direction })
                }
                onRemove={() =>
                  dispatch({ type: "REMOVE_BLOCK", locale, index })
                }
              />
            ))}
          </ol>
        )}

        <div className="border-sand-100 mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
          <span className="text-petroleum-400 mr-1 text-xs font-medium">
            {tBlocks("add")}
          </span>
          {BLOCK_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              disabled={submitting}
              onClick={() =>
                dispatch({ type: "ADD_BLOCK", locale, block: emptyBlock(type) })
              }
              className="border-sand-200 text-petroleum-700 hover:border-petroleum-400 hover:bg-sand-50 flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-xs font-medium transition-colors"
            >
              <IconPlus />
              {tBlocks(type)}
            </button>
          ))}
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

/** One block in the stack: its type, its controls, and up/down/remove. */
function BlockEditor({
  index,
  total,
  block,
  disabled,
  error,
  onChange,
  onMove,
  onRemove,
}: {
  index: number;
  total: number;
  block: ContentBlock;
  disabled: boolean;
  error: string | undefined;
  onChange: (block: ContentBlock) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("dashboard.campaigns.content.blocks");
  const fieldError = useFieldError();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /** Wraps the selection (or inserts at the caret) in the paragraph textarea. */
  function surround(before: string, after: string, placeholder: string) {
    if (block.type !== "paragraph") return;
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? block.text.length;
    const end = el.selectionEnd ?? start;
    const selected = block.text.slice(start, end) || placeholder;
    const next =
      block.text.slice(0, start) +
      before +
      selected +
      after +
      block.text.slice(end);
    onChange({ ...block, text: next });
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + before.length + selected.length;
      el.setSelectionRange(start + before.length, cursor);
    });
  }

  const iconClass =
    "text-petroleum-400 hover:text-petroleum-700 disabled:opacity-30 rounded-lg p-1.5 transition-colors";

  return (
    <li className="border-sand-200 bg-sand-50 rounded-2xl border p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-petroleum-500 text-xs font-semibold tracking-wide uppercase">
          {index + 1} · {t(block.type)}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label={t("moveUp")}
            disabled={disabled || index === 0}
            onClick={() => onMove(-1)}
            className={`${iconClass} rotate-180`}
          >
            <IconChevronDown />
          </button>
          <button
            type="button"
            aria-label={t("moveDown")}
            disabled={disabled || index === total - 1}
            onClick={() => onMove(1)}
            className={iconClass}
          >
            <IconChevronDown />
          </button>
          <button
            type="button"
            aria-label={t("remove")}
            disabled={disabled}
            onClick={onRemove}
            className={`${iconClass} hover:text-red-600`}
          >
            <IconTrash />
          </button>
        </div>
      </div>

      {block.type === "paragraph" && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            <ToolbarButton
              label={t("bold")}
              icon={<span className="font-bold">B</span>}
              disabled={disabled}
              onClick={() => surround("**", "**", t("linkText"))}
            />
            <ToolbarButton
              label={t("link")}
              icon={<IconEdit />}
              disabled={disabled}
              onClick={() => surround("[", "](https://)", t("linkText"))}
            />
            <ToolbarButton
              label={t("name")}
              icon={<IconUserCircle />}
              disabled={disabled}
              onClick={() => surround("{{first_name}}", "", "")}
            />
          </div>
          <textarea
            ref={textareaRef}
            value={block.text}
            rows={5}
            disabled={disabled}
            placeholder={t("paragraphPlaceholder")}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            className={`${TEXTAREA_CLASS} min-h-32 bg-white text-[14px] leading-relaxed`}
          />
        </div>
      )}

      {block.type === "heading" && (
        <input
          type="text"
          value={block.text}
          disabled={disabled}
          placeholder={t("headingPlaceholder")}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
          className={`${INPUT_CLASS} text-base font-semibold`}
        />
      )}

      {block.type === "image" && (
        <div className="flex flex-col gap-2">
          <ImageUpload
            bucket="campaigns"
            folder="images"
            value={block.url}
            onChange={(url) => onChange({ ...block, url })}
          />
          <input
            type="url"
            value={block.url}
            disabled={disabled}
            placeholder={t("imageUrl")}
            aria-label={t("imageUrl")}
            onChange={(e) => onChange({ ...block, url: e.target.value })}
            className={INPUT_CLASS}
          />
          <input
            type="text"
            value={block.alt}
            disabled={disabled}
            placeholder={t("imageAlt")}
            aria-label={t("imageAlt")}
            onChange={(e) => onChange({ ...block, alt: e.target.value })}
            className={INPUT_CLASS}
          />
        </div>
      )}

      {block.type === "button" && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            type="text"
            value={block.text}
            disabled={disabled}
            placeholder={t("buttonText")}
            aria-label={t("buttonText")}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            className={INPUT_CLASS}
          />
          <input
            type="url"
            value={block.url}
            disabled={disabled}
            placeholder="https://"
            aria-label={t("buttonUrl")}
            onChange={(e) => onChange({ ...block, url: e.target.value })}
            className={INPUT_CLASS}
          />
        </div>
      )}

      {block.type === "divider" && (
        <div className="flex items-center gap-3 py-1">
          <span className="text-petroleum-400">
            <IconMinus />
          </span>
          <hr className="border-sand-200 flex-1" />
          <span className="text-petroleum-400">
            <IconImage />
          </span>
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-500">{fieldError(error)}</p>
      )}
    </li>
  );
}

function ToolbarButton({
  label,
  icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="border-sand-200 text-petroleum-700 hover:border-petroleum-400 flex h-8 items-center gap-1.5 rounded-lg border bg-white px-2.5 text-xs font-medium transition-colors disabled:opacity-50 [&_svg]:size-3.5"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
