"use client";

import {
  useId,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { IconEye, IconEyeOff } from "@/components/ui/icons";

// ─── PasswordInput ─────────────────────────────────────────────

type PasswordInputProps = Omit<ComponentPropsWithoutRef<"input">, "type"> & {
  inputClassName?: string;
};

export function PasswordInput({
  className,
  inputClassName,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`relative ${className ?? ""}`}>
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={[
          "w-full pr-10",
          inputClassName ??
            "border-sand-200 text-petroleum-700 placeholder:text-petroleum-100 focus:border-petroleum-400 focus:ring-petroleum-100 rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:ring-2",
        ].join(" ")}
      />
      <button
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        onClick={() => setVisible((v) => !v)}
        className="text-petroleum-300 hover:text-petroleum-500 absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
        tabIndex={-1}
      >
        {visible ? <IconEyeOff /> : <IconEye />}
      </button>
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
