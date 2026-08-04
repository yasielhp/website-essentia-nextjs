"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, X } from "lucide-react";
import {
  isMobileViewport,
  useDropdownPortal,
} from "@/hooks/use-dropdown-portal";
import { TierThumbnail } from "@/components/ui/tier-thumbnail";

/**
 * The session-type picker, shared by the public booking flow and both dashboard
 * booking screens.
 *
 * It existed three times, character-for-character apart from where the strings
 * came from — the same split that had let the service picker drift. Prices are
 * resolved by the caller because only the dashboard knows about the room and
 * home-visit rates, and the strings are passed in because the public flow
 * translates while the dashboard is English-only.
 */

export type TierPickerOption = {
  id: string;
  label: string | null;
  durationMinutes: number | null;
  price: number | null;
  imageUrl?: string | null;
  color?: string | null;
};

export type TierPickerLabels = {
  /** Sits above the chosen value in the closed trigger. */
  fieldLabel: string;
  placeholder: string;
  modalTitle: string;
  close: string;
  /** Shown for a tier with no label of its own. */
  standard: string;
};

/** `Espira · 60 min · €90`, skipping whatever the tier does not have. */
function summarize(option: TierPickerOption, standard: string): string {
  const parts: string[] = [];
  if (option.label) parts.push(option.label);
  if (option.durationMinutes != null)
    parts.push(`${option.durationMinutes} min`);
  if (option.price != null) parts.push(`€${option.price}`);
  return parts.join(" · ") || standard;
}

function meta(option: TierPickerOption): string | null {
  const parts = [
    option.durationMinutes != null ? `${option.durationMinutes} min` : null,
    option.price != null ? `€${option.price}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function TierItems({
  options,
  selectedId,
  onSelect,
  standard,
}: {
  options: TierPickerOption[];
  selectedId: string | null;
  onSelect: (option: TierPickerOption) => void;
  standard: string;
}) {
  return (
    <div className="p-3">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onSelect(option)}
          className="hover:bg-sand-100 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150 active:scale-[0.98]"
        >
          <TierThumbnail
            imageUrl={option.imageUrl}
            color={option.color}
            label={option.label}
          />
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="text-petroleum-700 font-medium">
              {option.label ?? standard}
            </span>
            {meta(option) && (
              <span className="text-petroleum-400 text-xs">{meta(option)}</span>
            )}
          </div>
          {selectedId === option.id && (
            <Check className="text-petroleum-700 shrink-0" size={14} />
          )}
        </button>
      ))}
    </div>
  );
}

/**
 * The read-only card for a service with a single session type: there is nothing
 * to choose, so it states the choice instead of offering it.
 */
export function TierSummaryCard({
  option,
  labels,
}: {
  option: TierPickerOption;
  labels: Pick<TierPickerLabels, "fieldLabel" | "standard">;
}) {
  return (
    <div className="border-sand-300 bg-sand-50 flex items-center gap-4 rounded-2xl border p-4">
      <TierThumbnail
        imageUrl={option.imageUrl}
        color={option.color}
        label={option.label}
      />
      <div className="flex flex-1 flex-col gap-1">
        <p className="text-petroleum-400 text-xs">{labels.fieldLabel}</p>
        <p className="text-petroleum-700 font-medium">
          {summarize(option, labels.standard)}
        </p>
      </div>
      <Check className="text-petroleum-100 shrink-0" size={16} />
    </div>
  );
}

export function TierPicker({
  options,
  selectedId,
  onSelect,
  labels,
  collapseSingle = false,
}: {
  options: TierPickerOption[];
  selectedId: string | null;
  onSelect: (option: TierPickerOption) => void;
  labels: TierPickerLabels;
  /** Render the single option as a card rather than a one-item dropdown. */
  collapseSingle?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { triggerRef, dropdownRef, dropdownStyle } = useDropdownPortal(isOpen);
  const selected = options.find((o) => o.id === selectedId) ?? null;

  useEffect(() => {
    if (!isOpen || isMobileViewport()) return;
    const handleClose = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      )
        return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClose);
    return () => document.removeEventListener("mousedown", handleClose);
  }, [isOpen, triggerRef, dropdownRef]);

  useEffect(() => {
    if (!isOpen || !isMobileViewport()) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleSelect = (option: TierPickerOption) => {
    onSelect(option);
    setIsOpen(false);
  };

  if (collapseSingle && options.length === 1 && options[0]) {
    return <TierSummaryCard option={options[0]} labels={labels} />;
  }

  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className={[
          "bg-sand-50 flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200",
          isOpen
            ? "border-petroleum-400 ring-petroleum-100 ring-2"
            : "border-sand-300 hover:border-petroleum-400",
        ].join(" ")}
      >
        {selected ? (
          <>
            <TierThumbnail
              imageUrl={selected.imageUrl}
              color={selected.color}
              label={selected.label}
            />
            <div className="flex flex-1 flex-col gap-1">
              <p className="text-petroleum-400 text-xs">{labels.fieldLabel}</p>
              <p className="text-petroleum-700 font-medium">
                {summarize(selected, labels.standard)}
              </p>
            </div>
          </>
        ) : (
          <p className="text-petroleum-400 flex-1 text-sm">
            {labels.placeholder}
          </p>
        )}
        <ChevronDown
          className={[
            "shrink-0 transition-transform duration-200",
            selected ? "text-petroleum-400" : "text-petroleum-100",
            isOpen ? "rotate-180" : "",
          ].join(" ")}
          size={16}
        />
      </button>

      {/* Desktop: dropdown portal */}
      {isOpen &&
        !isMobileViewport() &&
        createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="border-sand-300 bg-sand-50 animate-fade-in-down z-9999 overflow-y-auto rounded-2xl border shadow-lg"
          >
            <TierItems
              options={options}
              selectedId={selectedId}
              onSelect={handleSelect}
              standard={labels.standard}
            />
          </div>,
          document.body,
        )}

      {/* Mobile: full-screen modal */}
      {isOpen &&
        isMobileViewport() &&
        createPortal(
          <div className="animate-slide-up-modal fixed inset-0 z-50 flex flex-col bg-white">
            <div className="border-sand-100 flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-petroleum-700 font-medium">
                {labels.modalTitle}
              </h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="hover:bg-sand-50 rounded-xl p-2 transition-colors"
                aria-label={labels.close}
              >
                <X size={20} className="text-petroleum-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <TierItems
                options={options}
                selectedId={selectedId}
                onSelect={handleSelect}
                standard={labels.standard}
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
