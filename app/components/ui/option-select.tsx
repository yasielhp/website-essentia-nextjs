"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { IconChevronDown, IconCheckmark } from "@/components/ui/icons";

/**
 * Dropdown for choices that need a label *and* an explanation.
 *
 * A native `<select>` cannot render two lines per option, and stacking the
 * choices as cards costs a lot of vertical space once there are more than
 * three. This keeps the footprint of a select while showing the description
 * that makes each choice unambiguous.
 *
 * Follows the dashboard's existing dropdown behaviour (see `UserMenu`):
 * click outside to dismiss, plus Escape and arrow-key navigation.
 */

export type SelectOption<T extends string> = {
  value: T;
  label: string;
  desc?: string;
};

type Props<T extends string> = {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  id?: string;
  disabled?: boolean;
  /** Accessible name when the field has no visible `<label>` bound to it. */
  ariaLabel?: string;
  /** Shown on the trigger when nothing is selected yet. */
  placeholder?: string;
  /**
   * Adds a filter box once the list passes this length. A dropdown of dozens of
   * people is unusable without one.
   */
  searchableFrom?: number;
};

export function OptionSelect<T extends string>({
  value,
  options,
  onChange,
  id,
  disabled = false,
  ariaLabel,
  placeholder,
  searchableFrom = 8,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const listboxId = `${id ?? generatedId}-listbox`;

  const selected = options.find((o) => o.value === value);
  const searchable = options.length >= searchableFrom;

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    return options.filter((o) =>
      `${o.label} ${o.desc ?? ""}`.toLowerCase().includes(term),
    );
  }, [options, query]);

  // Closing always clears the filter, so the next open starts fresh. Doing it
  // here rather than in an effect keeps the state change in the event that
  // caused it.
  function close() {
    setOpen(false);
    setQuery("");
  }

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) close();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function moveSelection(offset: number) {
    const current = options.findIndex((o) => o.value === value);
    const next = options[(current + offset + options.length) % options.length];
    if (next) onChange(next.value);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={(e) => {
          if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
          e.preventDefault();
          if (!open) {
            setOpen(true);
            return;
          }
          moveSelection(e.key === "ArrowDown" ? 1 : -1);
        }}
        className="border-sand-200 focus:border-petroleum-400 focus:ring-petroleum-100 flex w-full items-center justify-between rounded-xl border bg-white px-4 py-3 text-left outline-none focus:ring-2 disabled:opacity-60"
      >
        <span className="min-w-0">
          <span
            className={`block text-sm font-medium ${
              selected ? "text-petroleum-700" : "text-petroleum-300"
            }`}
          >
            {selected?.label ?? placeholder ?? ""}
          </span>
          {selected?.desc && (
            <span className="text-petroleum-400 mt-0.5 block text-xs">
              {selected.desc}
            </span>
          )}
        </span>
        <span
          className={`text-petroleum-400 shrink-0 transition-transform duration-150 ${
            open ? "rotate-180" : ""
          }`}
        >
          <IconChevronDown />
        </span>
      </button>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          className="border-sand-200 absolute top-full right-0 left-0 z-30 mt-2 max-h-80 overflow-auto rounded-2xl border bg-white shadow-lg"
        >
          {searchable && (
            <li className="border-sand-100 sticky top-0 border-b bg-white p-2">
              <input
                type="search"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="border-sand-200 text-petroleum-700 placeholder:text-petroleum-300 focus:border-petroleum-400 w-full rounded-xl border px-3 py-2 text-sm outline-none"
              />
            </li>
          )}
          {visible.length === 0 && (
            <li className="text-petroleum-300 px-4 py-3 text-sm">
              No matches.
            </li>
          )}
          {visible.map((option) => {
            const isSelected = option.value === value;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option.value);
                    close();
                  }}
                  className={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors ${
                    isSelected ? "bg-petroleum-50" : "hover:bg-sand-50"
                  }`}
                >
                  <span className="min-w-0">
                    <span
                      className={`block text-sm font-medium ${
                        isSelected ? "text-petroleum-700" : "text-petroleum-500"
                      }`}
                    >
                      {option.label}
                    </span>
                    {option.desc && (
                      <span className="text-petroleum-400 mt-0.5 block text-xs">
                        {option.desc}
                      </span>
                    )}
                  </span>
                  {isSelected && (
                    <IconCheckmark className="text-petroleum-500 mt-0.5 shrink-0" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
