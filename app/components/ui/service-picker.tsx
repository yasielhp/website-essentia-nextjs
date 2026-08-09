"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { ChevronDown, Check, X } from "lucide-react";
import {
  isMobileViewport,
  useDropdownPortal,
} from "@/hooks/use-dropdown-portal";

/**
 * The service chooser used by the public booking flow and by both dashboard
 * booking screens.
 *
 * There were three copies of it, and they had drifted: the public one always
 * opened downward with a fixed height while the dashboard ones flipped upward
 * when short of room, and only the dashboard handled a service with no image.
 * Sharing it means a fix lands everywhere, and the two surfaces cannot look
 * different by accident again.
 *
 * Strings are passed in rather than read here. The public flow translates its
 * services through next-intl and the dashboard shows what the database stores,
 * so resolving text is the caller's job; this component only lays it out.
 */

export type ServicePickerOption = {
  id: string;
  title: string;
  description?: string;
  /** Drives the section a service is listed under. */
  category?: string;
  /** Falls back to the initial on a tile when absent. */
  image?: string;
};

export type ServicePickerLabels = {
  placeholder: string;
  modalTitle: string;
  close: string;
  wellness: string;
  medicine: string;
};

function OptionRows({
  options,
  selectedId,
  onSelect,
  labels,
  imageClass = "size-12",
  imageSizes = "48px",
}: {
  options: ServicePickerOption[];
  selectedId: string | null;
  onSelect: (option: ServicePickerOption) => void;
  labels: ServicePickerLabels;
  imageClass?: string;
  imageSizes?: string;
}) {
  // A service with no category is treated as wellness rather than dropped,
  // so a row added to the database still shows up somewhere.
  const wellness = options.filter(
    (s) => s.category === "wellness" || !s.category,
  );
  const medicine = options.filter((s) => s.category === "medicine");

  const row = (s: ServicePickerOption) => (
    <button
      key={s.id}
      type="button"
      onClick={() => onSelect(s)}
      className="hover:bg-sand-100 flex w-full items-center gap-3 rounded-xl p-2 text-left transition-all duration-150 active:scale-[0.98]"
    >
      {s.image ? (
        <div
          className={`relative ${imageClass} shrink-0 overflow-hidden rounded-lg`}
        >
          <Image
            src={s.image}
            alt={s.title}
            fill
            sizes={imageSizes}
            className="object-cover"
          />
        </div>
      ) : (
        <div
          className={`bg-petroleum-100 flex ${imageClass} shrink-0 items-center justify-center rounded-lg`}
        >
          <span className="text-petroleum-700 text-sm font-bold">
            {s.title[0]?.toUpperCase()}
          </span>
        </div>
      )}
      <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
        <p className="text-petroleum-700 text-sm font-medium">{s.title}</p>
        {s.description && (
          <p className="text-petroleum-400 line-clamp-1 text-xs">
            {s.description}
          </p>
        )}
      </div>
      {selectedId === s.id && (
        <Check className="text-petroleum-700 shrink-0" size={14} />
      )}
    </button>
  );

  return (
    <div className="p-3">
      {wellness.length > 0 && (
        <>
          <p className="text-petroleum-500 p-2 text-xs tracking-widest uppercase">
            {labels.wellness}
          </p>
          {wellness.map(row)}
        </>
      )}
      {medicine.length > 0 && (
        <>
          <p className="text-petroleum-500 mt-2 p-2 text-xs tracking-widest uppercase">
            {labels.medicine}
          </p>
          {medicine.map(row)}
        </>
      )}
    </div>
  );
}

export function ServicePicker({
  options,
  selected,
  onSelect,
  labels,
}: {
  options: ServicePickerOption[];
  selected: ServicePickerOption | null;
  onSelect: (option: ServicePickerOption) => void;
  labels: ServicePickerLabels;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { triggerRef, dropdownRef, dropdownStyle } = useDropdownPortal(isOpen);

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

  // The sheet covers the page, so the page behind it must not scroll.
  useEffect(() => {
    if (!isOpen || !isMobileViewport()) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  function handleSelect(option: ServicePickerOption) {
    onSelect(option);
    setIsOpen(false);
  }

  const chevron = (
    <ChevronDown
      className={`text-petroleum-400 shrink-0 transition-transform duration-200 ${
        isOpen ? "rotate-180" : ""
      }`}
      size={16}
    />
  );

  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className={[
          "flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200",
          isOpen
            ? "border-petroleum-400 ring-petroleum-100 ring-2"
            : "border-sand-300 hover:border-petroleum-400",
          "bg-sand-50",
        ].join(" ")}
      >
        {selected ? (
          <>
            {selected.image ? (
              <div className="animate-fade-in-up relative size-20 shrink-0 overflow-hidden rounded-xl">
                <Image
                  src={selected.image}
                  alt={selected.title}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="bg-petroleum-100 flex size-20 shrink-0 items-center justify-center rounded-xl">
                <span className="text-petroleum-700 text-lg font-bold">
                  {selected.title[0]?.toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex flex-1 flex-col gap-1.5 overflow-hidden">
              <p className="text-petroleum-700 font-medium">{selected.title}</p>
              {selected.description && (
                <p className="text-petroleum-400 line-clamp-2 text-sm">
                  {selected.description}
                </p>
              )}
            </div>
            {chevron}
          </>
        ) : (
          <>
            <div className="bg-sand-200 flex size-20 shrink-0 items-center justify-center rounded-xl">
              <span className="text-petroleum-100 text-lg">+</span>
            </div>
            <p className="text-petroleum-400 flex-1 text-sm">
              {labels.placeholder}
            </p>
            {chevron}
          </>
        )}
      </button>

      {/* Desktop: a portal, to escape the stacking contexts that would clip it */}
      {isOpen &&
        !isMobileViewport() &&
        createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="border-sand-300 bg-sand-50 animate-fade-in-down z-9999 overflow-y-auto rounded-2xl border shadow-lg"
          >
            <OptionRows
              options={options}
              selectedId={selected?.id ?? null}
              onSelect={handleSelect}
              labels={labels}
            />
          </div>,
          document.body,
        )}

      {/* Mobile: a full-screen sheet, where a dropdown would be unusable */}
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
              <OptionRows
                options={options}
                selectedId={selected?.id ?? null}
                onSelect={handleSelect}
                labels={labels}
                imageClass="size-16"
                imageSizes="64px"
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
