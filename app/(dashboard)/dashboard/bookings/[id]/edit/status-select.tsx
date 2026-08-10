"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { ChevronDown, Check } from "lucide-react";
import { useDropdownPortal } from "@/hooks/use-dropdown-portal";
import type { BookingStatus, StatusOption } from "./form-state";

const STATUS_DOTS: Record<BookingStatus, string> = {
  pending: "bg-yellow-400",
  confirmed: "bg-green-500",
  cancelled: "bg-red-400",
};

const STATUS_IDS: BookingStatus[] = ["pending", "confirmed", "cancelled"];

export function useStatusOptions(): StatusOption[] {
  const t = useTranslations("dashboard.bookings.edit.statuses");
  return STATUS_IDS.map((id) => ({
    id,
    label: t(`${id}.label`),
    description: t(`${id}.description`),
    dot: STATUS_DOTS[id],
  }));
}

export function StatusSelect({
  selected,
  onSelect,
}: {
  selected: BookingStatus;
  onSelect: (s: BookingStatus) => void;
}) {
  const statuses = useStatusOptions();
  const [isOpen, setIsOpen] = useState(false);
  const { triggerRef, dropdownRef, dropdownStyle } = useDropdownPortal(isOpen);
  const active = statuses.find((s) => s.id === selected) ?? statuses[0]!;

  useEffect(() => {
    if (!isOpen) return;
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

  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className={[
          "bg-sand-50 flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-colors duration-200",
          isOpen
            ? "border-petroleum-400 ring-petroleum-100 ring-2"
            : "border-sand-300 hover:border-petroleum-400",
        ].join(" ")}
      >
        <div className="bg-sand-200 flex size-14 shrink-0 items-center justify-center rounded-xl">
          <span className={`size-3.5 rounded-full ${active.dot}`} />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <p className="text-petroleum-700 font-medium">{active.label}</p>
          <p className="text-petroleum-400 text-sm">{active.description}</p>
        </div>
        <ChevronDown
          className={[
            "text-petroleum-400 shrink-0 transition-transform duration-200",
            isOpen ? "rotate-180" : "",
          ].join(" ")}
          size={16}
        />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="border-sand-300 bg-sand-50 animate-fade-in-down z-[9999] overflow-hidden rounded-2xl border shadow-lg"
          >
            <div className="p-3">
              {statuses.map(({ id, label, description, dot }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    onSelect(id);
                    setIsOpen(false);
                  }}
                  className="hover:bg-sand-100 flex w-full items-center gap-3 rounded-xl p-2 text-left transition-[background-color,transform] duration-150 active:scale-[0.98]"
                >
                  <div className="bg-sand-200 flex size-12 shrink-0 items-center justify-center rounded-lg">
                    <span className={`size-3 rounded-full ${dot}`} />
                  </div>
                  <div className="flex flex-1 flex-col gap-0.5">
                    <p className="text-petroleum-700 text-sm font-medium">
                      {label}
                    </p>
                    <p className="text-petroleum-400 text-xs">{description}</p>
                  </div>
                  {selected === id && (
                    <Check className="text-petroleum-700 shrink-0" size={14} />
                  )}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
