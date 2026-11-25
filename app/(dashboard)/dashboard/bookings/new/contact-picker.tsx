"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { IconPlus } from "@/components/ui/icons";
import { INPUT_CLASS } from "@/constants/form-styles";
import { searchDeskContacts } from "@/actions/desk-booking";
import { getAccessToken } from "@/lib/client-session";
import type { DeskContactOption } from "@/lib/bookings/desk-consents";

type Status = "loading" | "done" | "failed";

/** What a search box shorter than this asks for, instead of a search. */
const MIN_QUERY = 2;
/** How long typing must pause before the server is asked. */
const DEBOUNCE_MS = 250;

/**
 * Who the booking is for: a client already on file, looked up by name, email
 * or phone, or a new one. A combobox: the first option is always "New client"
 * (the fields below stay empty for her details), then the clients that match.
 * Up and Down move through them, Enter picks, Escape closes. The list opens
 * above the box, so what comes after the step never covers it.
 *
 * The search is the server's (`searchDeskContacts`): a partner finds only the
 * clients of her own bookings.
 */
export function ContactPicker({
  onPick,
  onNew,
  disabled = false,
}: {
  onPick: (contact: DeskContactOption) => void;
  onNew: () => void;
  disabled?: boolean;
}) {
  const t = useTranslations("dashboard.bookings.form.client");
  const id = useId();
  const listboxId = `${id}-listbox`;
  const optionId = (index: number) => `${id}-option-${index}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<DeskContactOption[]>([]);
  const [status, setStatus] = useState<Status>("done");
  const [active, setActive] = useState(0);
  // Only the answer to the latest question is shown.
  const latest = useRef(0);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  /** Asks the server a moment after typing stops; only the latest answer shows. */
  function search(value: string) {
    if (timer.current) clearTimeout(timer.current);
    const ask = ++latest.current;
    const term = value.trim();
    if (term.length < MIN_QUERY) {
      setResults([]);
      return;
    }
    setStatus("loading");
    timer.current = setTimeout(() => {
      void searchDeskContacts(getAccessToken(), term)
        .then((result) => {
          if (ask !== latest.current) return;
          setResults(result.ok ? result.contacts : []);
          setStatus(result.ok ? "done" : "failed");
        })
        .catch(() => {
          if (ask !== latest.current) return;
          setResults([]);
          setStatus("failed");
        });
    }, DEBOUNCE_MS);
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  // Option 0 is "New client"; the clients follow.
  const count = results.length + 1;
  const activeIndex = Math.min(active, count - 1);

  function choose(index: number) {
    setOpen(false);
    setQuery("");
    search("");
    setActive(0);
    if (index === 0) onNew();
    else {
      const contact = results[index - 1];
      if (contact) onPick(contact);
    }
  }

  const line = (contact: DeskContactOption) =>
    [contact.email, contact.phone].filter(Boolean).join(" · ");
  const name = (contact: DeskContactOption) =>
    [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
    contact.email;

  const short = query.trim().length < MIN_QUERY;
  const message = short
    ? t("typeMore")
    : status === "loading"
      ? t("searching")
      : status === "failed"
        ? t("searchFailed")
        : results.length === 0
          ? t("noResults")
          : null;

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1.5">
      <label
        htmlFor={`${id}-input`}
        className="text-petroleum-500 text-xs font-medium"
      >
        {t("pickerLabel")}
      </label>
      {/* The list opens UPWARD, over the step's own title: the cards after
          this step (the payment) would otherwise cover it. */}
      <div className="relative">
        <input
          id={`${id}-input`}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={open ? optionId(activeIndex) : undefined}
          autoComplete="off"
          spellCheck={false}
          value={query}
          disabled={disabled}
          placeholder={t("pickerPlaceholder")}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            search(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              if (!open) {
                setOpen(true);
                return;
              }
              const offset = event.key === "ArrowDown" ? 1 : -1;
              setActive((activeIndex + offset + count) % count);
            } else if (event.key === "Enter" && open) {
              event.preventDefault();
              choose(activeIndex);
            } else if (event.key === "Escape" && open) {
              event.preventDefault();
              setOpen(false);
            }
          }}
          className={INPUT_CLASS}
        />

        {open && (
          <ul
            id={listboxId}
            role="listbox"
            aria-label={t("pickerLabel")}
            className="border-sand-200 absolute right-0 bottom-full left-0 z-20 mb-2 max-h-80 overflow-y-auto rounded-2xl border bg-white p-1.5 shadow-lg"
          >
            <li
              id={optionId(0)}
              role="option"
              aria-selected={activeIndex === 0}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(0)}
              onClick={() => choose(0)}
              className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 ${
                activeIndex === 0 ? "bg-sand-100" : ""
              }`}
            >
              <span
                aria-hidden="true"
                className="bg-petroleum-50 text-petroleum-500 flex size-8 shrink-0 items-center justify-center rounded-full"
              >
                <IconPlus />
              </span>
              <span className="min-w-0">
                <span className="text-petroleum-700 block text-sm font-medium">
                  {t("newClient")}
                </span>
                <span className="text-petroleum-400 block text-xs">
                  {t("newClientDesc")}
                </span>
              </span>
            </li>
            {results.map((contact, i) => (
              <li
                key={contact.id}
                id={optionId(i + 1)}
                role="option"
                aria-selected={activeIndex === i + 1}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(i + 1)}
                onClick={() => choose(i + 1)}
                className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 ${
                  activeIndex === i + 1 ? "bg-sand-100" : ""
                }`}
              >
                <span
                  aria-hidden="true"
                  className="bg-sand-100 text-petroleum-500 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium uppercase"
                >
                  {(contact.firstName[0] ?? contact.email[0] ?? "").trim()}
                  {(contact.lastName[0] ?? "").trim()}
                </span>
                <span className="min-w-0">
                  <span className="text-petroleum-700 block truncate text-sm font-medium">
                    {name(contact)}
                  </span>
                  <span className="text-petroleum-400 block truncate text-xs">
                    {line(contact)}
                  </span>
                </span>
              </li>
            ))}
            {message && (
              <li
                role="presentation"
                aria-live="polite"
                className="text-petroleum-400 px-3 py-2.5 text-xs"
              >
                {message}
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
