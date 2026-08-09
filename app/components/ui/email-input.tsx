"use client";

import { useState, type InputHTMLAttributes } from "react";
import { useTranslations } from "next-intl";
import { isValidEmail, suggestEmailFix } from "@/utils/email";

type EmailInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "onChange" | "value"
> & {
  value: string;
  /** Receives the raw text while typing, and the normalised value on blur. */
  onChange: (value: string) => void;
  /** Set when the form already shows its own error for this field. */
  hasError?: boolean;
};

/**
 * The email field, everywhere.
 *
 * A mistyped address fails silently: the confirmation goes nowhere, the client
 * believes the session is booked, and nobody finds out until they do not turn
 * up. So this does three things a plain input does not.
 *
 * It normalises on blur rather than on every keystroke — lowercasing under
 * someone's fingers as they type reads as a bug, while doing it once they
 * leave the field is invisible and gets a clean value into the database.
 *
 * It only complains after the field has been left. Marking "a" as invalid on
 * the first keypress is hostile; once it has been flagged, it re-checks as
 * they type so the error clears the moment it is fixed.
 *
 * And it offers a correction for near-miss domains — gmial.com, gmail.con —
 * which is where most bad addresses actually come from. The suggestion is a
 * button: it is never applied without a click.
 */
export function EmailInput({
  value,
  onChange,
  hasError = false,
  onBlur,
  className = "",
  ...props
}: EmailInputProps) {
  const t = useTranslations();
  // The dashboard and the public site load different namespaces.
  const prefix = t.has("dashboard.emailField.invalid")
    ? "dashboard.emailField"
    : "common.emailField";

  const [touched, setTouched] = useState(false);

  const trimmed = value.trim();
  const showInvalid = touched && trimmed.length > 0 && !isValidEmail(trimmed);
  const suggestion = touched && !showInvalid ? suggestEmailFix(trimmed) : null;

  return (
    <>
      <input
        {...props}
        type="email"
        inputMode="email"
        autoComplete={props.autoComplete ?? "email"}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => {
          setTouched(true);
          const normalised = e.target.value.trim().toLowerCase();
          if (normalised !== e.target.value) onChange(normalised);
          onBlur?.(e);
        }}
        aria-invalid={hasError || showInvalid || undefined}
        className={className}
      />

      {showInvalid && !hasError && (
        <p className="text-xs text-red-600">{t(`${prefix}.invalid`)}</p>
      )}

      {suggestion && (
        <p className="text-petroleum-500 text-xs">
          {t(`${prefix}.didYouMean`)}{" "}
          <button
            type="button"
            onClick={() => onChange(suggestion)}
            className="text-petroleum-700 font-medium underline underline-offset-2"
          >
            {suggestion}
          </button>
        </p>
      )}
    </>
  );
}
