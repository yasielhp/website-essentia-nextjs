"use client";

import { useTranslations } from "next-intl";
import { INPUT_CLASS, TEXTAREA_CLASS } from "@/constants/form-styles";

/**
 * The shape every field on a dashboard edit form takes: a label, and either the
 * control or a grey bar where it will be.
 *
 * The race and education edit screens were the same form twice — same toggle,
 * same bilingual title and description, same date, time, place, capacity and
 * access — written out longhand in both, at eleven lines a field. What actually
 * differs between them is one field and the access options.
 */

function FieldShell({
  id,
  label,
  required,
  loading,
  /** How tall the placeholder is, so it does not jump when the value lands. */
  skeleton = "h-11",
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  loading: boolean;
  skeleton?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-petroleum-500 text-xs font-medium">
        {label}
        {required && <span className="text-red-400"> *</span>}
      </label>
      {loading ? (
        <div className={`bg-sand-100 animate-pulse rounded-xl ${skeleton}`} />
      ) : (
        children
      )}
    </div>
  );
}

type Common = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  loading: boolean;
  disabled: boolean;
};

export function TextField({
  type = "text",
  ...field
}: Common & { type?: "text" | "date" | "time" }) {
  return (
    <FieldShell
      id={field.id}
      label={field.label}
      required={field.required}
      loading={field.loading}
    >
      <input
        id={field.id}
        type={type}
        value={field.value}
        onChange={(e) => field.onChange(e.target.value)}
        placeholder={field.placeholder}
        disabled={field.disabled}
        className={INPUT_CLASS}
      />
    </FieldShell>
  );
}

export function TextAreaField(field: Common) {
  return (
    <FieldShell
      id={field.id}
      label={field.label}
      required={field.required}
      loading={field.loading}
      skeleton="h-20"
    >
      <textarea
        id={field.id}
        value={field.value}
        onChange={(e) => field.onChange(e.target.value)}
        placeholder={field.placeholder}
        disabled={field.disabled}
        className={`${TEXTAREA_CLASS} min-h-20`}
      />
    </FieldShell>
  );
}

/**
 * A number with its unit inside the box.
 *
 * The unit sits over the input rather than in the label — "Duration (min)"
 * reads as part of the field's name rather than of its value.
 */
export function NumberField({
  unit,
  min,
  step,
  ...field
}: Common & { unit?: string; min?: string; step?: string }) {
  return (
    <FieldShell
      id={field.id}
      label={field.label}
      required={field.required}
      loading={field.loading}
    >
      {unit ? (
        <div className="relative">
          <input
            id={field.id}
            type="number"
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
            placeholder={field.placeholder}
            min={min}
            step={step}
            disabled={field.disabled}
            className={INPUT_CLASS + " pr-12"}
          />
          <span className="text-petroleum-400 pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm">
            {unit}
          </span>
        </div>
      ) : (
        <input
          id={field.id}
          type="number"
          value={field.value}
          onChange={(e) => field.onChange(e.target.value)}
          placeholder={field.placeholder}
          min={min}
          step={step}
          disabled={field.disabled}
          className={INPUT_CLASS}
        />
      )}
    </FieldShell>
  );
}

export function SelectField({
  options,
  ...field
}: Common & { options: { value: string; label: string }[] }) {
  return (
    <FieldShell
      id={field.id}
      label={field.label}
      required={field.required}
      loading={field.loading}
    >
      <select
        id={field.id}
        value={field.value}
        onChange={(e) => field.onChange(e.target.value)}
        disabled={field.disabled}
        className={INPUT_CLASS}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

/** Which language the title and description below are being written in. */
export function LangToggle({
  lang,
  onChange,
}: {
  lang: "en" | "es";
  onChange: (lang: "en" | "es") => void;
}) {
  const tCommon = useTranslations("dashboard.common");

  return (
    <div className="bg-sand-100 flex gap-1 rounded-lg p-1">
      {(["en", "es"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          className={[
            "rounded-md px-3 py-1 text-xs font-semibold tracking-wide uppercase transition-colors",
            lang === l
              ? "text-petroleum-700 bg-white shadow-sm"
              : "text-petroleum-400 hover:text-petroleum-600",
          ].join(" ")}
        >
          {l === "en" ? tCommon("english") : tCommon("spanish")}
        </button>
      ))}
    </div>
  );
}
