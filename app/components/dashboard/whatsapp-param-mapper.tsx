"use client";

import { useTranslations } from "next-intl";
import { OptionSelect, type SelectOption } from "@/components/ui/option-select";
import { INPUT_CLASS } from "@/constants/form-styles";
import type {
  WhatsAppParamField,
  WhatsAppParamSource,
} from "@/lib/whatsapp/types";

/** The longest a fixed text can be; the schema holds the same line. */
const MAX_STATIC = 200;

/**
 * One `{{n}}` of a WhatsApp template: where its value comes from, a contact
 * field or a fixed text, and what is wrong with it. Shared by the campaign
 * form and the transactional messages, which differ in the fields they offer
 * and in the sentence that says a field has no value there.
 */
/** One `{{n}}`: a contact field or a fixed text, with what is wrong with it. */
export function WhatsAppParamRow({
  index,
  source,
  example,
  available,
  error,
  disabled,
  fields,
  unavailableText,
  idPrefix,
  onChange,
}: {
  index: number;
  source: WhatsAppParamSource;
  example: string | undefined;
  /** False when the chosen field has no value for what is being configured. */
  available: boolean;
  error: string;
  disabled: boolean;
  /** The contact fields the picker offers. */
  fields: readonly WhatsAppParamField[];
  /** What the amber note says when `available` is false. */
  unavailableText: string;
  /** Ids of the controls are `${idPrefix}-${index}-…`, so two of these can coexist. */
  idPrefix: string;
  onChange: (source: WhatsAppParamSource) => void;
}) {
  const t = useTranslations("dashboard.campaigns.form.whatsapp");
  const tFields = useTranslations("dashboard.campaigns.form.whatsapp.fields");
  const id = `${idPrefix}-${index}`;

  const kindOptions: SelectOption<"field" | "static">[] = [
    { value: "field", label: t("sourceField") },
    { value: "static", label: t("sourceStatic") },
  ];
  const fieldOptions: SelectOption<WhatsAppParamField>[] = fields.map(
    (field) => ({ value: field, label: tFields(field) }),
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-petroleum-700 text-sm font-medium">
          {t("param", { n: index + 1 })}
        </p>
        {example && (
          <p className="text-petroleum-400 text-xs">
            {t("paramExample", { example })}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`${id}-kind`}
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("sourceKind")}
          </label>
          <OptionSelect
            id={`${id}-kind`}
            value={source.kind}
            options={kindOptions}
            disabled={disabled}
            onChange={(value) =>
              onChange(
                value === "field"
                  ? {
                      kind: "field",
                      field: fields.includes("first_name")
                        ? "first_name"
                        : (fields[0] ?? "first_name"),
                    }
                  : { kind: "static", value: "" },
              )
            }
          />
        </div>

        {source.kind === "field" ? (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`${id}-field`}
              className="text-petroleum-500 text-xs font-medium"
            >
              {t("fieldLabel")}
            </label>
            <OptionSelect
              id={`${id}-field`}
              value={source.field}
              options={fieldOptions}
              disabled={disabled}
              onChange={(field) => onChange({ kind: "field", field })}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`${id}-text`}
              className="text-petroleum-500 text-xs font-medium"
            >
              {t("staticLabel")}
            </label>
            <input
              id={`${id}-text`}
              type="text"
              value={source.value}
              placeholder={t("staticPlaceholder")}
              disabled={disabled}
              aria-invalid={error ? true : undefined}
              aria-describedby={`${id}-note`}
              onChange={(e) =>
                onChange({ kind: "static", value: e.target.value })
              }
              className={INPUT_CLASS}
            />
          </div>
        )}
      </div>

      <div id={`${id}-note`} className="flex flex-col gap-1">
        {source.kind === "static" && (
          <p
            className={`text-xs ${
              source.value.length > MAX_STATIC
                ? "text-red-600"
                : source.value.trim() === ""
                  ? "text-yellow-800"
                  : "text-petroleum-400"
            }`}
          >
            {t("staticCount", { count: source.value.length })}
            {source.value.trim() === "" && ` · ${t("staticEmpty")}`}
          </p>
        )}
        {error && (
          <p role="alert" className="text-xs text-red-600">
            {error}
          </p>
        )}
        {!available && (
          <p className="rounded-xl bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
            {unavailableText}
          </p>
        )}
      </div>
    </div>
  );
}
