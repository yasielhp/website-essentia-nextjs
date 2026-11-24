"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
  /** A picture for the option, drawn on the trigger and in the list (decorative: the label says it). */
  icon?: ReactNode;
  /** A small tag after the label ("Coming soon", "Suggested"). */
  badge?: string;
  /** Shown but not pickable: greyed, skipped by the arrows, announced as disabled. */
  disabled?: boolean;
};

/**
 * The index the arrows go to from `from` (-1 for "nowhere yet"), `offset` steps
 * round the list, skipping options that cannot be picked; -1 when none can.
 * Pure.
 */
export function nextEnabledIndex<T extends string>(
  options: SelectOption<T>[],
  from: number,
  offset: 1 | -1,
): number {
  const count = options.length;
  if (count === 0) return -1;
  let at = from;
  for (let step = 0; step < count; step += 1) {
    at =
      at === -1
        ? offset === 1
          ? 0
          : count - 1
        : (at + offset + count) % count;
    if (!options[at]?.disabled) return at;
  }
  return -1;
}

/** The picture's box: the same size on the trigger and in the list. */
const ICON_BOX =
  "bg-sand-100 text-petroleum-500 flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-5";

const BADGE =
  "bg-sand-100 text-petroleum-400 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap";

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
  /**
   * Whether the arrow keys CHOOSE (the default: they change the value, as a
   * native select does) or only move the focus through the list, so a choice
   * is made only by activating an option. For a select whose choice does
   * something (it advances a form).
   */
  commitOnArrows?: boolean;
  /** Starts with the list open. For a test of the list; nothing else needs it. */
  defaultOpen?: boolean;
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
  commitOnArrows = true,
  defaultOpen = false,
}: Props<T>) {
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // Set when the list is opened by an arrow: focus goes into it once it is drawn.
  const focusOnOpen = useRef(false);
  const generatedId = useId();
  const listboxId = `${id ?? generatedId}-listbox`;

  const selected = options.find((o) => o.value === value);
  const searchable = options.length >= searchableFrom;
  // Some options have a picture: the others keep an empty slot so names line up.
  const anyIcon = options.some((o) => o.icon);

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
      if (e.key !== "Escape") return;
      close();
      // Focus is not left on an option that is about to leave the page.
      if (!commitOnArrows) triggerRef.current?.focus();
      // Marks the key as spent: a modal around this select closes on Escape
      // too, and should leave that one to the list that was open.
      e.preventDefault();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
    // `close` and `commitOnArrows` do not change while it is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function enabledOptionButtons(): HTMLButtonElement[] {
    return Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>(
        'button[role="option"]:not([disabled])',
      ) ?? [],
    );
  }

  // Opened by an arrow in the focus-only mode: the focus goes to the chosen
  // option (or the first one that can be picked).
  useEffect(() => {
    if (!open || !focusOnOpen.current) return;
    focusOnOpen.current = false;
    const buttons = enabledOptionButtons();
    (
      buttons.find((b) => b.getAttribute("aria-selected") === "true") ??
      buttons[0]
    )?.focus();
  }, [open]);

  /** Focus-only mode: the arrows walk the options that can be picked. */
  function moveFocus(offset: 1 | -1) {
    const buttons = enabledOptionButtons();
    if (buttons.length === 0) return;
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      at === -1
        ? offset === 1
          ? 0
          : buttons.length - 1
        : (at + offset + buttons.length) % buttons.length;
    buttons[next]?.focus();
  }

  function moveSelection(offset: 1 | -1) {
    const current = options.findIndex((o) => o.value === value);
    const next = options[nextEnabledIndex(options, current, offset)];
    if (next) onChange(next.value);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        ref={triggerRef}
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
            focusOnOpen.current = !commitOnArrows;
            setOpen(true);
            return;
          }
          const offset = e.key === "ArrowDown" ? 1 : -1;
          if (commitOnArrows) moveSelection(offset);
          else moveFocus(offset);
        }}
        className="border-sand-200 focus:border-petroleum-400 focus:ring-petroleum-100 flex w-full items-center justify-between rounded-xl border bg-white px-4 py-3 text-left outline-none focus:ring-2 disabled:opacity-60"
      >
        <span
          className={anyIcon ? "flex min-w-0 items-center gap-3" : "min-w-0"}
        >
          {selected?.icon && (
            <span aria-hidden="true" className={ICON_BOX}>
              {selected.icon}
            </span>
          )}
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
          ref={listRef}
          role="listbox"
          onKeyDown={(e) => {
            // In the focus-only mode the arrows walk the options from inside the list too.
            if (commitOnArrows) return;
            if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
            e.preventDefault();
            moveFocus(e.key === "ArrowDown" ? 1 : -1);
          }}
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
                aria-label="Search"
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
                  disabled={option.disabled}
                  aria-disabled={option.disabled ? true : undefined}
                  onClick={() => {
                    onChange(option.value);
                    close();
                  }}
                  className={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors ${
                    isSelected ? "bg-petroleum-50" : "hover:bg-sand-50"
                  }${option.disabled ? "cursor-not-allowed opacity-55 hover:bg-transparent" : ""}`}
                >
                  <span
                    className={
                      anyIcon ? "flex min-w-0 items-start gap-3" : "min-w-0"
                    }
                  >
                    {anyIcon &&
                      (option.icon ? (
                        <span aria-hidden="true" className={ICON_BOX}>
                          {option.icon}
                        </span>
                      ) : (
                        <span aria-hidden="true" className="size-9 shrink-0" />
                      ))}
                    <span className="min-w-0">
                      <span
                        className={`block text-sm font-medium ${
                          isSelected
                            ? "text-petroleum-700"
                            : "text-petroleum-500"
                        }`}
                      >
                        {option.badge ? (
                          <span className="flex flex-wrap items-center gap-2">
                            {option.label}
                            <span className={BADGE}>{option.badge}</span>
                          </span>
                        ) : (
                          option.label
                        )}
                      </span>
                      {option.desc && (
                        <span className="text-petroleum-400 mt-0.5 block text-xs">
                          {option.desc}
                        </span>
                      )}
                    </span>
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
