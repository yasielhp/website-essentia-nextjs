"use client";

import type { KeyboardEvent } from "react";

/**
 * Which language of a text is on screen, when it is written in more than one:
 * the same pill the page of a message has in Settings, but as buttons (there
 * the two languages are two pages; here they are two versions of one form).
 *
 * One language is no choice: nothing is drawn. A version with something
 * missing carries a dot, and says so in words for who cannot see it.
 */
export function LocaleTabs<L extends string>({
  id,
  label,
  locales,
  active,
  onChange,
  nameOf,
  incomplete = [],
  incompleteText,
  disabled = false,
}: {
  /** Prefix of the ids, so two of these can share a page. */
  id: string;
  /** What is being chosen, e.g. "Language". */
  label: string;
  locales: readonly L[];
  active: L;
  onChange: (locale: L) => void;
  nameOf: (locale: L) => string;
  /** The versions with something missing. */
  incomplete?: readonly L[];
  /** Said after the name of an incomplete version, for a screen reader. */
  incompleteText?: string;
  disabled?: boolean;
}) {
  if (locales.length < 2) return null;

  // Arrow keys move the choice, as in any group of radios.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (step === 0 || disabled) return;
    event.preventDefault();
    const index = locales.indexOf(active);
    const next = locales[(index + step + locales.length) % locales.length];
    if (next === undefined) return;
    onChange(next);
    document.getElementById(`${id}-${next}`)?.focus();
  };

  return (
    <div className="flex flex-col gap-1.5">
      <p id={`${id}-label`} className="text-petroleum-500 text-xs font-medium">
        {label}
      </p>
      <div
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        onKeyDown={onKeyDown}
        className="bg-sand-100 flex w-fit rounded-full p-0.5 text-sm"
      >
        {locales.map((locale) => {
          const selected = locale === active;
          const missing = incomplete.includes(locale);
          return (
            <button
              key={locale}
              id={`${id}-${locale}`}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(locale)}
              className={`focus-visible:ring-petroleum-500 inline-flex min-h-11 items-center gap-1.5 rounded-full px-5 font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-8 sm:px-4 ${
                selected
                  ? "text-petroleum-700 bg-white shadow-sm"
                  : "text-petroleum-400 hover:text-petroleum-700"
              }`}
            >
              {nameOf(locale)}
              {missing && (
                <>
                  <span
                    aria-hidden="true"
                    data-incomplete={locale}
                    className="size-1.5 rounded-full bg-amber-500"
                  />
                  {incompleteText && (
                    <span className="sr-only">{incompleteText}</span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
