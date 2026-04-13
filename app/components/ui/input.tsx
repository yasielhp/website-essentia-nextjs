"use client";

import { useId, type ComponentPropsWithoutRef, type ReactNode } from "react";

// ─── Variantes ────────────────────────────────────────────────

type Variant = "default" | "error" | "success";

const variantClasses: Record<Variant, string> = {
  default:
    "border-petroleum-200 bg-transparent text-petroleum-700 placeholder:text-petroleum-400 focus:border-petroleum-500 focus:ring-petroleum-500/20",
  error:
    "border-red-400 bg-transparent text-petroleum-700 placeholder:text-petroleum-400 focus:border-red-500 focus:ring-red-500/20",
  success:
    "border-green-500 bg-transparent text-petroleum-700 placeholder:text-petroleum-400 focus:border-green-600 focus:ring-green-600/20",
};

const baseInputClasses =
  "w-full rounded-full border px-5 py-3 text-sm font-body outline-none transition-all duration-200 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50";

// ─── Tipos ────────────────────────────────────────────────────

type InputProps = ComponentPropsWithoutRef<"input"> & {
  label?: string;
  hint?: string;
  error?: string;
  variant?: Variant;
  leftElement?: ReactNode;
  rightElement?: ReactNode;
};

// ─── Componente ───────────────────────────────────────────────

export function Input({
  label,
  hint,
  error,
  variant,
  leftElement,
  rightElement,
  className,
  id: externalId,
  ...props
}: InputProps) {
  const generatedId = useId();
  const id = externalId ?? generatedId;

  const resolvedVariant: Variant = error ? "error" : (variant ?? "default");

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-petroleum-500 text-sm font-medium">
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        {leftElement && (
          <span className="text-petroleum-400 pointer-events-none absolute left-4">
            {leftElement}
          </span>
        )}

        <input
          id={id}
          aria-describedby={hint || error ? `${id}-description` : undefined}
          aria-invalid={!!error}
          className={[
            baseInputClasses,
            variantClasses[resolvedVariant],
            leftElement ? "pl-10" : "",
            rightElement ? "pr-10" : "",
            className ?? "",
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        />

        {rightElement && (
          <span className="text-petroleum-400 pointer-events-none absolute right-4">
            {rightElement}
          </span>
        )}
      </div>

      {(hint || error) && (
        <p
          id={`${id}-description`}
          className={`text-xs ${error ? "text-red-500" : "text-petroleum-400"}`}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

// ─── Checkbox ─────────────────────────────────────────────────

type CheckboxProps = ComponentPropsWithoutRef<"input"> & {
  label: ReactNode;
  error?: string;
};

export function Checkbox({
  label,
  error,
  id: externalId,
  className,
  ...props
}: CheckboxProps) {
  const generatedId = useId();
  const id = externalId ?? generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id={id}
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={!!error}
          className={[
            "mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded accent-current transition-all duration-200 focus:ring-2",
            error
              ? "border-red-400 outline outline-1 outline-red-400 focus:ring-red-500/20"
              : "border-petroleum-300 text-petroleum-700 focus:ring-petroleum-500/20",
            className ?? "",
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        />
        <label
          htmlFor={id}
          className="text-petroleum-500 cursor-pointer text-sm leading-snug"
        >
          {label}
        </label>
      </div>

      {error && (
        <p id={`${id}-error`} className="text-xs text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}
