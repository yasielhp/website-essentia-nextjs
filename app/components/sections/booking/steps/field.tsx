"use client";

import { useValidationMessage } from "@/hooks/use-validation-message";

/** Input styling shared by the public forms that step through a purchase. */
export const inputClass =
  "bg-sand-100 text-petroleum-700 placeholder:text-petroleum-100 border rounded-xl px-4 py-3 text-sm outline-none transition-colors duration-200 focus:ring-2 w-full";
export const inputOk =
  "border-sand-300 focus:border-petroleum-400 focus:ring-petroleum-100";
export const inputErr =
  "border-red-300 focus:border-red-400 focus:ring-red-100";

/** A labelled field with its validation message underneath. */
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
  children: React.ReactNode;
}) {
  const validationMessage = useValidationMessage();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-petroleum-500 text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs text-red-500">{validationMessage(error)}</p>
      )}
    </div>
  );
}
