"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { ChevronDown, Check, X } from "lucide-react";
import type { TierStaff } from "@/actions/tier-staff";

/** The photo, or their initial when there is none. */
function StaffAvatar({ person }: { person: TierStaff }) {
  if (person.avatarUrl) {
    return (
      <Image
        src={person.avatarUrl}
        alt=""
        width={40}
        height={40}
        className="size-10 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="bg-sand-200 text-petroleum-500 flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-medium">
      {person.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

function StaffItems({
  options,
  selected,
  onSelect,
}: {
  options: TierStaff[];
  selected: string | null;
  onSelect: (person: TierStaff) => void;
}) {
  return (
    <div className="p-3">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onSelect(opt)}
          className="hover:bg-sand-100 flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-all duration-150 active:scale-[0.98]"
        >
          <span className="flex min-w-0 items-center gap-3">
            <StaffAvatar person={opt} />
            <span className="flex min-w-0 flex-col">
              <span className="text-petroleum-700 truncate font-medium">
                {opt.name}
              </span>
              {opt.jobTitle && (
                <span className="text-petroleum-400 truncate text-xs">
                  {opt.jobTitle}
                </span>
              )}
            </span>
          </span>
          {selected === opt.id && (
            <Check className="text-petroleum-700 shrink-0" size={14} />
          )}
        </button>
      ))}
    </div>
  );
}

export type StaffSelectLabels = {
  /** Shown under the name when the person has no job title. */
  fieldLabel: string;
  placeholder: string;
  modalTitle: string;
  close: string;
};

/**
 * Who performs the session.
 *
 * Shared by the public booking flow and the dashboard's booking forms so the
 * three ask the question the same way: photo, name, job title. The wording is
 * passed in because the two live in different message namespaces.
 */
export function StaffSelect({
  options,
  selected,
  onSelect,
  labels,
}: {
  options: TierStaff[];
  selected: string | null;
  onSelect: (person: TierStaff) => void;
  labels: StaffSelectLabels;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.id === selected) ?? null;

  const isMobile = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 767px)").matches;

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 8,
      left: rect.left,
      width: rect.width,
    });
  };

  useEffect(() => {
    if (!isOpen || isMobile()) return;
    updatePosition();
    const handleClose = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      )
        return;
      setIsOpen(false);
    };
    const handleScroll = () => updatePosition();
    document.addEventListener("mousedown", handleClose);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClose);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isMobile()) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleSelect = (person: TierStaff) => {
    onSelect(person);
    setIsOpen(false);
  };

  return (
    <div>
      <button
        ref={triggerRef}
        onClick={() => setIsOpen((o) => !o)}
        className={[
          "bg-sand-50 flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200",
          isOpen
            ? "border-petroleum-400 ring-petroleum-100 ring-2"
            : "border-sand-300 hover:border-petroleum-400",
        ].join(" ")}
      >
        {selectedOption ? (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <StaffAvatar person={selectedOption} />
            <div className="flex min-w-0 flex-col">
              <p className="text-petroleum-700 truncate font-medium">
                {selectedOption.name}
              </p>
              <p className="text-petroleum-400 truncate text-xs">
                {selectedOption.jobTitle ?? labels.fieldLabel}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-petroleum-400 flex-1 text-sm">
            {labels.placeholder}
          </p>
        )}
        <ChevronDown
          className={[
            "shrink-0 transition-transform duration-200",
            selectedOption ? "text-petroleum-400" : "text-petroleum-100",
            isOpen ? "rotate-180" : "",
          ].join(" ")}
          size={16}
        />
      </button>

      {isOpen &&
        !isMobile() &&
        createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="border-sand-300 bg-sand-50 animate-fade-in-down z-[9999] max-h-96 overflow-y-auto rounded-2xl border shadow-lg"
          >
            <StaffItems
              options={options}
              selected={selected}
              onSelect={handleSelect}
            />
          </div>,
          document.body,
        )}

      {isOpen &&
        isMobile() &&
        createPortal(
          <div className="animate-slide-up-modal fixed inset-0 z-50 flex flex-col bg-white">
            <div className="border-sand-100 flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-petroleum-700 font-medium">
                {labels.modalTitle}
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="hover:bg-sand-50 rounded-xl p-2 transition-colors"
                aria-label={labels.close}
              >
                <X size={20} className="text-petroleum-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <StaffItems
                options={options}
                selected={selected}
                onSelect={handleSelect}
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
