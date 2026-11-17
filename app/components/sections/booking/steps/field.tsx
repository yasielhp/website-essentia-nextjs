"use client";

import { cloneElement } from "react";
import { useValidationMessage } from "@/hooks/use-validation-message";
import { fieldAria, fieldErrorId } from "./field-aria";

/** Input styling shared by the public forms that step through a purchase. */
export const inputClass =
  "bg-sand-100 text-petroleum-700 placeholder:text-petroleum-100 border rounded-xl px-4 py-3 text-sm outline-none transition-colors duration-200 focus:ring-2 w-full";
export const inputOk =
  "border-sand-300 focus:border-petroleum-400 focus:ring-petroleum-100";
export const inputErr =
  "border-red-300 focus:border-red-400 focus:ring-red-100";

/**
 * A labelled field with its validation message underneath.
 *
 * The control is the caller's, but what a screen reader must hear about it is
 * the same for every field, so it is added here: `aria-required`, and when
 * there is an error `aria-invalid` plus an `aria-describedby` that points at
 * the message (see `fieldAria`). The asterisk is decoration once the control
 * says "required" itself.
 */
export function Field({
  label,
  id,
  required,
  error,
  children,
}: {
  label: string;
  id: string;
  required?: boolean;
  error?: string;
  /** The one control of the field: an input, a select, a textarea. */
  children: React.ReactElement<React.AriaAttributes>;
}) {
  const validationMessage = useValidationMessage();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-petroleum-500 text-sm font-medium">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-red-400">
            *
          </span>
        )}
      </label>
      {cloneElement(children, fieldAria({ id, required, error }))}
      {error && (
        <p id={fieldErrorId(id)} className="text-xs text-red-500">
          {validationMessage(error)}
        </p>
      )}
    </div>
  );
}
